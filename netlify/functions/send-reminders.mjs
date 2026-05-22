/* ============================================================
   SPACE LAUNCH — send-reminders  (scheduled Netlify Function)
   Runs every 15 minutes: checks upcoming Space Coast launches
   against stored subscribers and sends email / SMS reminders.

   Email   -> Resend  (env: RESEND_API_KEY, RESEND_FROM)
   SMS     -> Twilio  (env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)

   Reminders for a channel are simply skipped if its env vars
   aren't set — the rest of the site keeps working regardless.
   ============================================================ */
import { getStore } from '@netlify/blobs';

/* run every 15 minutes */
export const config = { schedule: '*/15 * * * *' };

const LL2 = 'https://ll.thespacedevs.com/2.2.0';
const COAST = ['cape canaveral', 'kennedy space'];

function isUS(l) {
  const pad = l && l.pad;
  const cc = pad && (pad.country_code || (pad.location && pad.location.country_code));
  return cc === 'USA';
}
function isSpaceCoast(l) {
  const n = ((l && l.pad && l.pad.location && l.pad.location.name) || '').toLowerCase();
  return COAST.some((c) => n.indexOf(c) !== -1);
}

export default async () => {
  /* 1. upcoming U.S. launches */
  let launches = [];
  try {
    const r = await fetch(LL2 + '/launch/upcoming/?mode=detailed&limit=100');
    const d = await r.json();
    launches = (d.results || []).filter(isUS);
  } catch (e) {
    console.error('Launch Library fetch failed:', e);
    return new Response('Launch data unavailable', { status: 200 });
  }

  /* 2. walk subscribers */
  const store = getStore('subscribers');
  let list;
  try { list = await store.list({ prefix: 'sub_' }); }
  catch (e) { console.error('Blobs list failed:', e); return new Response('No store', { status: 200 }); }

  const now = Date.now();
  let sent = 0, checked = 0;

  for (const blob of (list.blobs || [])) {
    const sub = await store.get(blob.key, { type: 'json' });
    if (!sub) continue;
    checked++;
    sub.notified = sub.notified || {};
    let changed = false;

    const relevant = launches.filter((l) => {
      if (sub.scope === 'all') return true;
      if (sub.scope === 'space-coast') return isSpaceCoast(l);
      return String(l.id) === String(sub.scope);
    });

    for (const l of relevant) {
      const net = new Date(l.net).getTime();
      if (isNaN(net)) continue;
      const windowOpen = now >= net - sub.leadMinutes * 60000;
      if (windowOpen && now < net && !sub.notified[l.id]) {
        const ok = await deliver(sub, l);
        if (ok) { sub.notified[l.id] = true; changed = true; sent++; }
      }
    }
    if (changed) await store.setJSON(blob.key, sub);
  }

  const msg = 'send-reminders: checked ' + checked + ' subscribers, sent ' + sent + ' reminders.';
  console.log(msg);
  return new Response(msg, { status: 200 });
};

/* ---------- delivery ---------------------------------------- */

function launchDetails(l) {
  const name = String(l.name || 'A rocket launch').replace(' | ', ' — ');
  const when = new Date(l.net).toLocaleString('en-US', {
    timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short'
  });
  let webcast = '';
  const v = l.vidURLs || l.vid_urls;
  if (v && v.length) webcast = typeof v[0] === 'string' ? v[0] : (v[0].url || '');
  const pad = (l.pad && l.pad.name) || 'the Space Coast';
  return { name, when, webcast, pad };
}

async function deliver(sub, launch) {
  const d = launchDetails(launch);
  return sub.channel === 'email' ? sendEmail(sub.contact, d) : sendSMS(sub.contact, d);
}

async function sendEmail(to, d) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Space Launch <onboarding@resend.dev>';
  if (!key) { console.warn('RESEND_API_KEY not set — skipping email.'); return false; }

  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;' +
    'background:#05060e;color:#ecedfb;padding:32px;border-radius:14px">' +
      '<h1 style="font-size:20px;margin:0 0 4px">🚀 Launch Reminder</h1>' +
      '<p style="color:#9498c4;margin:0 0 18px">From <b>Space Launch</b> — your Space Coast tracker</p>' +
      '<h2 style="font-size:18px;color:#5ce1ff;margin:0 0 10px">' + esc(d.name) + '</h2>' +
      '<p style="margin:6px 0"><b>Liftoff:</b> ' + esc(d.when) + ' (Eastern)</p>' +
      '<p style="margin:6px 0"><b>Launch pad:</b> ' + esc(d.pad) + '</p>' +
      (d.webcast ? '<p style="margin:18px 0"><a href="' + esc(d.webcast) +
        '" style="background:#5ce1ff;color:#05060e;padding:11px 20px;border-radius:99px;' +
        'text-decoration:none;font-weight:bold">▶ Watch the live stream</a></p>' : '') +
      '<p style="color:#9498c4;font-size:13px;margin-top:22px">Find a clear view of the eastern sky. ' +
      'Titusville, Playalinda Beach and Jetty Park are great free spots. Clear skies!</p>' +
    '</div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        subject: '🚀 Launch reminder: ' + d.name,
        html
      })
    });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('Resend exception', e); return false; }
}

async function sendSMS(to, d) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from) { console.warn('Twilio env not set — skipping SMS.'); return false; }

  const body = '🚀 Launch reminder: ' + d.name + ' lifts off from Florida\'s Space Coast on ' +
    d.when + ' ET.' + (d.webcast ? ' Watch: ' + d.webcast : '') + ' — Space Launch';

  try {
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: from, Body: body })
    });
    if (!r.ok) console.error('Twilio error', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('Twilio exception', e); return false; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
