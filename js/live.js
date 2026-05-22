/* ============================================================
   SPACE LAUNCH — live tracking: active ops, ISS map, results
   ISS position polls app-wide; the Leaflet map is built lazily
   the first time the Live view opens.
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$, $$ = U.$$;
  const LV = SL.live = {};

  let map, issMarker, trail = [], poll = null;

  /* ---------- ISS live map (lazy) --------------------------- */

  LV.ensureMap = function () {
    if (map) { setTimeout(() => map.invalidateSize(), 80); return; }
    map = L.map('iss-map', {
      worldCopyJump: true, zoomControl: true, minZoom: 1
    }).setView([0, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 8
    }).addTo(map);

    issMarker = L.marker([0, 0], {
      icon: L.divIcon({ className: '', html: '<div class="iss-icon">🛰️</div>',
        iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map).bindPopup('International Space Station');

    const live = SL.state.stationsLive.iss;
    if (live) { issMarker.setLatLng([live.lat, live.lon]); map.setView([live.lat, live.lon], 3); }
    setTimeout(() => map.invalidateSize(), 80);
  };

  /* ---------- ISS polling (runs app-wide) ------------------- */

  async function pollISS() {
    try {
      const d = await fetch(SL.cfg.issApi + '/' + SL.cfg.issNorad).then((r) => r.json());
      const lat = +d.latitude, lon = +d.longitude;

      SL.state.stationsLive.iss = {
        lat: lat, lon: lon,
        alt: Math.round(d.altitude),
        vel: Math.round(d.velocity),
        sun: d.visibility === 'daylight'
      };

      if (map && issMarker) {
        issMarker.setLatLng([lat, lon]);
        const dot = L.circleMarker([lat, lon], {
          radius: 2.5, color: '#5ce1ff', weight: 0, fillOpacity: 0.5
        }).addTo(map);
        trail.push(dot);
        if (trail.length > 80) map.removeLayer(trail.shift());
      }

      const set = (k, v) => { const el = $('[data-iss="' + k + '"]'); if (el) el.textContent = v; };
      set('lat', Math.abs(lat).toFixed(2) + '° ' + (lat >= 0 ? 'N' : 'S'));
      set('lon', Math.abs(lon).toFixed(2) + '° ' + (lon >= 0 ? 'E' : 'W'));
      set('alt', Math.round(d.altitude) + ' km');
      set('vel', Math.round(d.velocity).toLocaleString() + ' km/h');
      set('fp',  Math.round(d.footprint).toLocaleString() + ' km');
      set('vis', d.visibility === 'daylight' ? 'Yes ☀' : 'No — eclipsed');

      const tag = $('#iss-livetag');
      if (tag) tag.textContent = '● TRACKING LIVE';

      if (SL.stations && SL.stations.updateLive) SL.stations.updateLive();
    } catch (e) {
      const tag = $('#iss-livetag');
      if (tag) tag.textContent = '● SIGNAL LOST — RETRYING';
    }
  }

  LV.start = function () {
    if (poll) return;
    pollISS();
    poll = setInterval(pollISS, 5000);
  };

  /* ---------- ACTIVE OPS PANEL ------------------------------ */

  LV.renderNow = function () {
    const box = $('#live-now');
    if (!box) return;
    const next = SL.state.launches[0];
    const now = Date.now();

    if (!next) {
      box.classList.remove('live-now--active');
      box.innerHTML = '<div class="ln"><div><p class="ln__badge">' +
        '<span class="pulse-dot"></span> Range quiet</p>' +
        '<p class="ln__name">No launches scheduled</p>' +
        '<p class="ln__sub">The manifest is clear — check back soon.</p></div></div>';
      return;
    }

    const t = new Date(next.net).getTime() - now;
    const abbrev = next.status && next.status.abbrev;
    const isLive = (t < 36e5 && t > -18e5) || abbrev === 'In Flight' || abbrev === 'Hold';
    const nm = U.splitName(next.name);
    const prov = (next.launch_service_provider && next.launch_service_provider.name) || '';
    const site = U.site(next._site);
    const wc = U.webcast(next);

    box.classList.toggle('live-now--active', !!isLive);
    box.innerHTML = '<div class="ln">' +
      '<div>' +
        '<p class="ln__badge"><span class="pulse-dot"></span> ' +
          (isLive ? 'Launch operations in progress' : 'Next launch standing by') + '</p>' +
        '<p class="ln__name">' + U.esc(nm.mission) + '</p>' +
        '<p class="ln__sub">' + U.esc([nm.vehicle, prov, site && site.short, U.fmtDateTime(next.net)]
          .filter(Boolean).join('  ·  ')) + '</p>' +
        (wc ? '<a class="btn btn--primary" style="margin-top:14px" target="_blank" ' +
              'rel="noopener" href="' + U.esc(wc) + '">▶ Watch the live stream</a>' : '') +
      '</div>' +
      '<div class="ln__cd" data-net="' + new Date(next.net).getTime() + '">--:--:--</div>' +
    '</div>';
    SL.app.tick();
  };

  /* ---------- RECENT RESULTS -------------------------------- */

  LV.renderRecent = function () {
    const box = $('#live-recent');
    if (!box) return;
    const items = SL.state.recent.slice(0, 8);
    if (!items.length) {
      box.innerHTML = '<p class="empty">No recent Space Coast launches on record.</p>';
      return;
    }
    box.innerHTML = items.map((lc) => {
      const nm = U.splitName(lc.name);
      const st = U.status(lc);
      const site = U.site(lc._site);
      const meta = [nm.vehicle, site && site.short, U.fmtDate(lc.net)].filter(Boolean).join(' · ');
      return '<div class="rc-row" data-id="' + U.esc(lc.id) + '" style="cursor:pointer">' +
        '<span class="tag ' + st.cls + '">' + U.esc(st.label) + '</span>' +
        '<div class="rc-row__name"><b>' + U.esc(nm.mission) + '</b>' +
          '<small>' + U.esc(meta) + '</small></div>' +
      '</div>';
    }).join('');
    $$('.rc-row', box).forEach((r) => r.onclick = () => SL.launches.openModalById(r.dataset.id));
  };

})(window.SL);
