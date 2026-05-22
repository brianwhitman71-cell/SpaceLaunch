/* ============================================================
   SPACE LAUNCH — space stations: specs, status, live position
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$, $$ = U.$$;
  const ST = SL.stations;              /* curated array; methods attached below */

  let tgPoll = null;

  /* ---------- render station cards + home mini -------------- */

  ST.render = function () {
    const box = $('#stations-list');
    if (box) {
      box.innerHTML = ST.map((s) => {
        const stats = s.stats.map((x) =>
          '<div class="ss-cell"><b>' + U.esc(x.v) + '</b><span>' + U.esc(x.k) + '</span></div>'
        ).join('');
        const specs = s.specs.map((r) =>
          '<div class="spec-row"><span>' + U.esc(r[0]) + '</span><span>' + U.esc(r[1]) + '</span></div>'
        ).join('');
        const facts = s.facts.map((f) => '<li>' + U.esc(f) + '</li>').join('');
        return '<article class="station" data-key="' + s.key + '">' +
          '<div class="station__top">' +
            '<div class="station__hero">' +
              '<p class="station__tag">' + U.esc(s.tag) + '</p>' +
              '<h2 class="station__name">' + U.esc(s.name) + '</h2>' +
              '<p class="station__desc">' + U.esc(s.desc) + '</p>' +
              '<p class="muted" data-st-status="' + s.key + '">Status: checking telemetry…</p>' +
              '<p class="muted" data-st-live="' + s.key + '">● Acquiring live orbital position…</p>' +
            '</div>' +
            '<div class="station__stats">' + stats + '</div>' +
          '</div>' +
          '<div class="station__body">' +
            '<div class="spec-list"><h3>Specifications</h3>' + specs + '</div>' +
            '<div class="facts"><h3>Operator</h3>' +
              '<p style="font-size:.88rem;color:var(--ink-dim);margin-bottom:18px">' + U.esc(s.operator) + '</p>' +
              '<h3>Did You Know</h3><ul>' + facts + '</ul>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    const mini = $('#home-station');
    if (mini) {
      mini.innerHTML =
        '<div class="st-mini">' +
          '<div class="st-mini__big" data-mini="alt">—</div>' +
          '<p class="muted" style="margin-top:-6px">ISS altitude right now</p>' +
          '<div class="st-mini__row"><span>Status</span><span data-mini="status">checking…</span></div>' +
          '<div class="st-mini__row"><span>Orbital speed</span><span data-mini="vel">—</span></div>' +
          '<div class="st-mini__row"><span>In sunlight</span><span data-mini="sun">—</span></div>' +
          '<div class="st-mini__row"><span>Crewed since</span><span>Nov 2000</span></div>' +
          '<a href="#stations" class="panel__more" style="margin-top:6px;display:inline-block">Explore the stations →</a>' +
        '</div>';
    }

    fetchStatus();
    ST.updateLive();
  };

  /* ---------- live operational status (Launch Library) ------ */

  async function fetchStatus() {
    try {
      const d = await U.cachedJSON(SL.cfg.ll2 + '/spacestation/?limit=30', SL.cfg.ttl.stations);
      (d.results || []).forEach((api) => {
        const match = ST.find((s) => s.ll2id === api.id);
        if (!match) return;
        const status = (api.status && api.status.name) || 'Operational';
        match._status = status;
        const el = $('[data-st-status="' + match.key + '"]');
        if (el) el.textContent = 'Status: ' + status;
        if (match.key === 'iss') {
          const m = $('[data-mini="status"]');
          if (m) m.textContent = status;
        }
      });
    } catch (e) {
      $$('[data-st-status]').forEach((el) => el.textContent = 'Status: Operational');
      const m = $('[data-mini="status"]');
      if (m) m.textContent = 'Operational';
    }
  }

  /* ---------- live orbital position ------------------------- */

  ST.updateLive = function () {
    const iss = SL.state.stationsLive.iss;
    if (iss) {
      const line = posLine(iss);
      const el = $('[data-st-live="iss"]');
      if (el) el.textContent = '● LIVE  ·  ' + line;
      const mAlt = $('[data-mini="alt"]'); if (mAlt) mAlt.textContent = iss.alt + ' km';
      const mVel = $('[data-mini="vel"]'); if (mVel) mVel.textContent = iss.vel.toLocaleString() + ' km/h';
      const mSun = $('[data-mini="sun"]'); if (mSun) mSun.textContent = iss.sun ? 'Yes ☀' : 'No';
    }
    const tg = SL.state.stationsLive.tiangong;
    const tgEl = $('[data-st-live="tiangong"]');
    if (tgEl) tgEl.textContent = tg
      ? '● LIVE  ·  ' + posLine(tg)
      : '● Live position unavailable for this station';
  };

  function posLine(p) {
    return Math.abs(p.lat).toFixed(1) + '° ' + (p.lat >= 0 ? 'N' : 'S') + '  ' +
           Math.abs(p.lon).toFixed(1) + '° ' + (p.lon >= 0 ? 'E' : 'W') + '  ·  ' +
           p.alt + ' km altitude';
  }

  async function pollTiangong() {
    try {
      const d = await fetch(SL.cfg.issApi + '/' + SL.cfg.tiangongNorad).then((r) => {
        if (!r.ok) throw new Error('no data'); return r.json();
      });
      SL.state.stationsLive.tiangong = {
        lat: +d.latitude, lon: +d.longitude, alt: Math.round(d.altitude)
      };
    } catch (e) {
      SL.state.stationsLive.tiangong = null;     /* endpoint may not carry this object */
    }
    ST.updateLive();
  }

  /* poll Tiangong while the Stations view is open (ISS comes free from live.js) */
  ST.start = function () {
    if (tgPoll) return;
    pollTiangong();
    tgPoll = setInterval(pollTiangong, 15000);
  };
  ST.stop = function () {
    if (tgPoll) { clearInterval(tgPoll); tgPoll = null; }
  };

})(window.SL);
