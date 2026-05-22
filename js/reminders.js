/* ============================================================
   SPACE LAUNCH — reminders: calendar (.ics), browser alerts,
   and email / SMS sign-up (via optional Netlify backend)
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$, $$ = U.$$;
  const R = SL.reminders = {};

  /* ---------- .ics calendar export -------------------------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function icsDate(d) {
    d = new Date(d);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
           pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }
  function icsEsc(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  R.downloadICS = function (lc) {
    if (!lc) return;
    const nm = U.splitName(lc.name);
    const start = new Date(lc.net);
    const end = new Date(start.getTime() + 3600000);
    const loc = (lc.pad && lc.pad.location && lc.pad.location.name) || 'Florida Space Coast';
    const wc = U.webcast(lc);
    const desc = (nm.vehicle ? nm.vehicle + '. ' : '') +
      ((lc.mission && lc.mission.description) || 'Rocket launch from Florida\'s Space Coast.') +
      (wc ? '\\n\\nWatch live: ' + wc : '');

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Space Launch//Launch Tracker//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + (lc.id || Date.now()) + '@space-launch',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(start),
      'DTEND:' + icsDate(end),
      'SUMMARY:' + icsEsc('🚀 ' + nm.mission + (nm.vehicle ? ' (' + nm.vehicle + ')' : '')),
      'DESCRIPTION:' + icsEsc(desc),
      'LOCATION:' + icsEsc(loc),
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY',
      'DESCRIPTION:' + icsEsc('Launch in 1 hour — ' + nm.mission),
      'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'launch-' + String(nm.mission).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* ---------- browser notifications ------------------------- */

  const NKEY = 'sl:notifs';
  function getNotifs() { try { return JSON.parse(localStorage.getItem(NKEY)) || []; } catch (e) { return []; } }
  function setNotifs(a) { try { localStorage.setItem(NKEY, JSON.stringify(a)); } catch (e) {} }

  function fireNotif(n) {
    if (Notification.permission !== 'granted') return;
    new Notification('🚀 Launch reminder — Space Launch', {
      body: n.name + ' lifts off at ' + U.fmtTime(n.net) + '. Time to find a clear view of the sky!',
      tag: 'sl-' + n.id
    });
  }

  function schedule(n) {
    const lead = (new Date(n.net).getTime() - n.lead * 60000) - Date.now();
    if (lead <= 0) {
      /* already inside the lead window — alert now if launch hasn't passed */
      if (new Date(n.net).getTime() > Date.now()) fireNotif(n);
      return false;
    }
    if (lead < 2147483647) setTimeout(() => fireNotif(n), lead);   /* setTimeout cap */
    return true;
  }

  R.rescheduleAll = function () {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const live = getNotifs().filter((n) => new Date(n.net).getTime() > Date.now());
    setNotifs(live);
    live.forEach(schedule);
  };

  async function enableNotif() {
    const status = $('#rem-notif-status');
    if (!('Notification' in window)) {
      status.className = 'rem-status rem-status--err';
      status.textContent = 'This browser doesn’t support notifications — try the calendar option instead.';
      return;
    }
    const sel = $('#rem-notif-select');
    const id = sel.value;
    const lc = SL.launches.find(id);
    if (!lc) {
      status.className = 'rem-status rem-status--err';
      status.textContent = 'Pick a launch first.';
      return;
    }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      status.className = 'rem-status rem-status--err';
      status.textContent = 'Notifications are blocked. Enable them for this site in your browser settings, or use the calendar option.';
      return;
    }
    const nm = U.splitName(lc.name);
    const n = { id: lc.id, name: nm.mission, net: lc.net, lead: +$('#rem-notif-lead').value };
    const all = getNotifs().filter((x) => !(x.id === n.id));
    all.push(n);
    setNotifs(all);
    schedule(n);
    status.className = 'rem-status rem-status--ok';
    status.textContent = '✓ Alert set for “' + nm.mission + '”. Keep this page bookmarked and open near launch time.';
  }

  /* ---------- email / SMS sign-up --------------------------- */

  function validContact(channel, value) {
    value = (value || '').trim();
    if (channel === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return value.replace(/[^\d]/g, '').length >= 10;     /* SMS: at least 10 digits */
  }

  async function submitForm(e) {
    e.preventDefault();
    const status = $('#rem-form-status');
    const channel = $('#rem-channel').value;
    const contact = $('#rem-contact').value.trim();
    const scope = $('#rem-scope').value;
    const lead = +$('#rem-lead').value;
    const btn = $('#rem-submit');

    if (!validContact(channel, contact)) {
      status.className = 'rem-status rem-status--err';
      status.textContent = channel === 'email'
        ? 'Please enter a valid email address.'
        : 'Please enter a valid phone number (include area code).';
      return;
    }

    const isGroup = (scope === 'all' || scope === 'space-coast');
    const lc = isGroup ? null : SL.launches.find(scope);
    const payload = {
      channel: channel, contact: contact, scope: scope,
      leadMinutes: lead,
      launchName: lc ? U.splitName(lc.name).mission
        : (scope === 'space-coast' ? 'All Space Coast launches' : 'All U.S. launches'),
      launchNet: lc ? lc.net : null
    };

    btn.disabled = true;
    status.className = 'rem-status rem-status--info';
    status.textContent = 'Sending…';

    try {
      const res = await fetch(SL.cfg.reminderFn, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        status.className = 'rem-status rem-status--ok';
        status.textContent = j.message ||
          ('✓ You’re subscribed. We’ll ' + (channel === 'email' ? 'email' : 'text') +
           ' you ' + leadLabel(lead) + ' before ' + payload.launchName + '.');
        $('#rem-form').reset();
        channelChanged();
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (err) {
      /* backend not deployed yet, or unreachable */
      status.className = 'rem-status rem-status--info';
      status.innerHTML = 'Email &amp; text delivery isn’t switched on yet — the backend needs to be deployed. ' +
        'In the meantime, use <b>Add to Your Calendar</b> or <b>Browser Notifications</b> above; both work right now.';
    }
    btn.disabled = false;
  }

  function leadLabel(m) {
    if (m >= 1440) return (m / 1440) + ' day' + (m / 1440 > 1 ? 's' : '');
    return (m / 60) + ' hour' + (m / 60 > 1 ? 's' : '');
  }

  function channelChanged() {
    const ch = $('#rem-channel').value;
    $('#rem-contact-label').textContent = ch === 'email' ? 'Email address' : 'Mobile number';
    $('#rem-contact').placeholder = ch === 'email' ? 'you@example.com' : '+1 555 123 4567';
    $('#rem-contact').type = ch === 'email' ? 'email' : 'tel';
  }

  /* ---------- launch <select> population -------------------- */

  R.populateLaunches = function () {
    const opts = SL.state.launches.map((lc) => {
      const nm = U.splitName(lc.name);
      const site = U.site(lc._site);
      return '<option value="' + U.esc(lc.id) + '">' +
        U.esc(nm.mission + '  —  ' + U.fmtDateShort(lc.net) +
          (site ? '  ·  ' + site.short : '')) + '</option>';
    }).join('');
    const none = '<option value="">No upcoming launches found</option>';

    const icsSel = $('#rem-ics-select'), nSel = $('#rem-notif-select'), scope = $('#rem-scope');
    if (icsSel) icsSel.innerHTML = opts || none;
    if (nSel)   nSel.innerHTML = opts || none;
    if (scope)  scope.innerHTML =
      '<option value="all">Every U.S. launch</option>' +
      '<option value="space-coast">Every Space Coast launch</option>' + opts;
  };

  R.preselect = function (id) {
    ['#rem-ics-select', '#rem-notif-select', '#rem-scope'].forEach((s) => {
      const el = $(s);
      if (el && [].some.call(el.options, (o) => o.value === String(id))) el.value = String(id);
    });
  };

  /* ---------- init ------------------------------------------ */

  R.init = function () {
    $('#rem-ics-btn').onclick = () => {
      const lc = SL.launches.find($('#rem-ics-select').value);
      if (lc) R.downloadICS(lc);
    };
    $('#rem-notif-btn').onclick = enableNotif;
    $('#rem-channel').onchange = channelChanged;
    $('#rem-form').addEventListener('submit', submitForm);
    channelChanged();
    R.rescheduleAll();
  };

})(window.SL);
