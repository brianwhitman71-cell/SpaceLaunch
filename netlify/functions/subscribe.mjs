/* ============================================================
   SPACE LAUNCH — /subscribe  (Netlify Function)
   Stores an email / SMS reminder subscription in Netlify Blobs.
   The companion scheduled function `send-reminders` does the sending.
   ============================================================ */
import { getStore } from '@netlify/blobs';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
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
    const store = getStore('subscribers');
    const id = (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2);

    await store.setJSON('sub_' + id, {
      id,
      channel,
      contact,
      scope,                                  /* 'all' or a launch id */
      leadMinutes,
      launchName: String(body.launchName || 'All Space Coast launches'),
      launchNet: body.launchNet || null,
      notified: {},                           /* launchId -> true once sent */
      createdAt: new Date().toISOString()
    });

    return json({
      ok: true,
      message: '✓ You’re subscribed! We’ll ' + (channel === 'email' ? 'email' : 'text') +
        ' you before liftoff.'
    });
  } catch (err) {
    console.error('subscribe error:', err);
    return json({ ok: false, message: 'Something went wrong saving your reminder.' }, 500);
  }
};
