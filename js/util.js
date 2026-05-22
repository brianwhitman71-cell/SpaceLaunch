/* ============================================================
   SPACE LAUNCH — shared utilities
   ============================================================ */
(function (SL) {
  'use strict';

  const U = SL.util = {};

  /* ---- DOM ---- */
  U.$  = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---- escape untrusted strings before injecting as HTML ---- */
  U.esc = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---- fetch JSON with a localStorage cache + stale fallback ---- */
  U.cachedJSON = async function (url, ttlMin) {
    const key = 'sl:' + url;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key)); } catch (e) { /* ignore */ }
    if (cached && (Date.now() - cached.t) < ttlMin * 60000) return cached.d;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* quota */ }
      return d;
    } catch (err) {
      if (cached) return cached.d;          /* serve stale data rather than fail */
      throw err;
    }
  };

  U.pad2 = (n) => String(n).padStart(2, '0');

  /* ---- countdown: ms remaining -> parts ---- */
  U.countdown = function (ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
      done: ms <= 0
    };
  };

  /* ---- dates (rendered in the visitor's local time zone) ---- */
  U.fmtDate = (d) => new Date(d).toLocaleDateString(undefined,
    { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  U.fmtDateShort = (d) => new Date(d).toLocaleDateString(undefined,
    { month: 'short', day: 'numeric' });

  U.fmtTime = (d) => new Date(d).toLocaleTimeString(undefined,
    { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

  U.fmtDateTime = (d) => U.fmtDate(d) + ' · ' + U.fmtTime(d);

  U.sameDay = (a, b) => {
    a = new Date(a); b = new Date(b);
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  };

  /* ---- launch name -> { vehicle, mission } ----
     LL2 names look like "Falcon 9 Block 5 | Starlink Group 12-7" */
  U.splitName = function (name) {
    const parts = String(name || '').split('|');
    if (parts.length > 1) {
      return { vehicle: parts[0].trim(), mission: parts.slice(1).join('|').trim() };
    }
    return { vehicle: '', mission: (name || 'Unnamed mission').trim() };
  };

  /* ---- map an LL2 status abbreviation to a CSS tag class + label ---- */
  U.status = function (launch) {
    const ab = (launch && launch.status && launch.status.abbrev) || 'TBD';
    const map = {
      'Go':              ['tag--go',      'Go for launch'],
      'TBC':             ['tag--tbd',     'To be confirmed'],
      'TBD':             ['tag--tbd',     'Date to be set'],
      'Hold':            ['tag--hold',    'Hold'],
      'In Flight':       ['tag--hold',    'In flight'],
      'Success':         ['tag--success', 'Successful'],
      'Failure':         ['tag--failure', 'Failure'],
      'Partial Failure': ['tag--failure', 'Partial failure']
    };
    const m = map[ab] || ['tag--tbd', ab];
    return { cls: m[0], label: m[1], abbrev: ab };
  };

  /* calendar dot kind: done (past) / go / tbd */
  U.calKind = function (launch) {
    if (new Date(launch.net).getTime() < Date.now()) return 'done';
    const ab = (launch.status && launch.status.abbrev) || 'TBD';
    return ab === 'Go' ? 'go' : 'tbd';
  };

  /* ---- is this launch from a U.S. site? ---- */
  U.isUS = function (launch) {
    const pad = launch && launch.pad;
    if (!pad) return false;
    const cc = pad.country_code || (pad.location && pad.location.country_code);
    return cc === 'USA';
  };

  /* ---- which U.S. launch site does this launch belong to? ---- */
  U.siteOf = function (launch) {
    const loc = launch && launch.pad && launch.pad.location && launch.pad.location.name;
    const low = (loc || '').toLowerCase();
    const sites = SL.sites || [];
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      if (s.key === 'other' || !s.match) continue;
      if (s.match.some((m) => low.indexOf(m) !== -1)) return s.key;
    }
    return 'other';
  };

  /* ---- look up a site definition by key ---- */
  U.site = (key) => (SL.sites || []).find((s) => s.key === key) || null;

  /* ---- best webcast URL from an LL2 launch ---- */
  U.webcast = function (launch) {
    const v = launch && (launch.vidURLs || launch.vid_urls);
    if (!v || !v.length) return null;
    const first = v[0];
    return typeof first === 'string' ? first : (first.url || null);
  };

  /* ---- pretty mission-card countdown string ---- */
  U.cdLabel = function (ms) {
    const c = U.countdown(ms);
    if (c.done) return 'In progress / past';
    if (c.d > 0) return c.d + 'd ' + U.pad2(c.h) + 'h';
    if (c.h > 0) return c.h + 'h ' + U.pad2(c.m) + 'm';
    return c.m + 'm ' + U.pad2(c.s) + 's';
  };

  /* ---- small helper to build an element ---- */
  U.frag = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content;
  };

})(window.SL);
