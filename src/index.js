/* ============================================================
   SPACE LAUNCH — Cloudflare Worker
   Serves the static site (ASSETS) and ports two Netlify functions:
     POST /.netlify/functions/subscribe   -> store reminder sub in KV
     (scheduled) send-reminders           -> cron every 15 min, walk subs

   Storage: Netlify Blobs ("subscribers") -> KV (SUBSCRIBERS).
   Email -> Resend (env: RESEND_API_KEY, RESEND_FROM)
   SMS   -> Twilio (env: TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM)
   Each channel is skipped if its env vars aren't set (faithful to
   the Netlify version — no keys were ever configured there).
   ============================================================ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/.netlify/functions/subscribe') return handleSubscribe(request, env);
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(env));
  },
};

/* ---------- /subscribe -------------------------------------- */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSubscribe(req, env) {
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ ok: false, message: 'Could not read your request.' }, 400); }

  const channel = body.channel === 'sms' ? 'sms' : 'email';
  const contact = String(body.contact || '').trim();
  const scope = String(body.scope || 'all');
  let leadMinutes = parseInt(body.leadMinutes, 10);
  if (isNaN(leadMinutes)) leadMinutes = 1440;
  leadMinutes = Math.min(Math.max(leadMinutes, 5), 10080);   /* 5 min – 7 days */

  if (channel === 'email' && !isEmail(contact))
    return json({ ok: false, message: 'That email address doesn’t look right.' }, 400);
  if (channel === 'sms' && contact.replace(/\D/g, '').length < 10)
    return json({ ok: false, message: 'That phone number doesn’t look right.' }, 400);

  try {
    const id = crypto.randomUUID();
    await env.SUBSCRIBERS.put('sub_' + id, JSON.stringify({
      id,
      channel,
      contact,
      scope,                                  /* 'all' or a launch id */
      leadMinutes,
      launchName: String(body.launchName || 'All Space Coast launches'),
      launchNet: body.launchNet || null,
      notified: {},                           /* launchId -> true once sent */
      createdAt: new Date().toISOString()
    }));

    return json({
      ok: true,
      message: '✓ You’re subscribed! We’ll ' + (channel === 'email' ? 'email' : 'text') +
        ' you before liftoff.'
    });
  } catch (err) {
    console.error('subscribe error:', err);
    return json({ ok: false, message: 'Something went wrong saving your reminder.' }, 500);
  }
}

/* ---------- scheduled: send-reminders ----------------------- */
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

/* iterate every subscriber key in KV (cursor-paginated) */
async function listSubKeys(env) {
  const keys = [];
  let cursor;
  do {
    const res = await env.SUBSCRIBERS.list({ prefix: 'sub_', cursor });
    for (const k of (res.keys || [])) keys.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return keys;
}

async function sendReminders(env) {
  /* 1. upcoming U.S. launches */
  let launches = [];
  try {
    const r = await fetch(LL2 + '/launch/upcoming/?mode=detailed&limit=100');
    const d = await r.json();
    launches = (d.results || []).filter(isUS);
  } catch (e) {
    console.error('Launch Library fetch failed:', e);
    return;
  }

  /* 2. walk subscribers */
  let keys;
  try { keys = await listSubKeys(env); }
  catch (e) { console.error('KV list failed:', e); return; }

  const now = Date.now();
  let sent = 0, checked = 0;

  for (const key of keys) {
    const sub = await env.SUBSCRIBERS.get(key, { type: 'json' });
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
        const ok = await deliver(env, sub, l);
        if (ok) { sub.notified[l.id] = true; changed = true; sent++; }
      }
    }
    if (changed) await env.SUBSCRIBERS.put(key, JSON.stringify(sub));
  }

  console.log('send-reminders: checked ' + checked + ' subscribers, sent ' + sent + ' reminders.');
}

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

async function deliver(env, sub, launch) {
  const d = launchDetails(launch);
  return sub.channel === 'email' ? sendEmail(env, sub.contact, d) : sendSMS(env, sub.contact, d);
}

async function sendEmail(env, to, d) {
  const key = env.RESEND_API_KEY;
  const from = env.RESEND_FROM || 'Space Launch <onboarding@resend.dev>';
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

async function sendSMS(env, to, d) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const tok = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if (!sid || !tok || !from) { console.warn('Twilio env not set — skipping SMS.'); return false; }

  const body = '🚀 Launch reminder: ' + d.name + ' lifts off from Florida\'s Space Coast on ' +
    d.when + ' ET.' + (d.webcast ? ' Watch: ' + d.webcast : '') + ' — Space Launch';

  try {
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(sid + ':' + tok),
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
