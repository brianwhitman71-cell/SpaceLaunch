/* ============================================================
   SPACE LAUNCH — launches: U.S.-wide data, calendar, launch-site
   directory + per-site pages, and the mission detail modal.
   The Space Coast is the featured home base; every other U.S.
   spaceport gets its own page.
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$, $$ = U.$$;
  const L = SL.launches = {};

  let calYear, calMonth, calScope = 'all';

  /* ---------- data loading ---------------------------------- */

  L.load = async function () {
    const base = SL.cfg.ll2, ttl = SL.cfg.ttl.launches, lim = SL.cfg.ll2Limit;
    let upcoming = [], recent = [];

    try {
      const u = await U.cachedJSON(base + '/launch/upcoming/?mode=detailed&limit=' + lim, ttl);
      upcoming = (u.results || []).filter(U.isUS);
    } catch (e) { console.warn('upcoming launches failed', e); }

    try {
      const p = await U.cachedJSON(base + '/launch/previous/?mode=detailed&limit=40', ttl);
      recent = (p.results || []).filter(U.isUS);
    } catch (e) { console.warn('previous launches failed', e); }

    upcoming.forEach((l) => l._site = U.siteOf(l));
    recent.forEach((l) => l._site = U.siteOf(l));
    upcoming.sort((a, b) => new Date(a.net) - new Date(b.net));
    recent.sort((a, b) => new Date(b.net) - new Date(a.net));

    SL.state.launches = upcoming;
    SL.state.recent = recent;

    const seen = {};
    SL.state.all = recent.concat(upcoming).filter((x) => {
      if (seen[x.id]) return false; seen[x.id] = 1; return true;
    });

    renderHero();
    renderUpnext();
    renderUSAStrip();
    initCalendar();
    L.renderSitesDirectory();
    if (SL.ticker) SL.ticker.build();
  };

  L.find = (id) => (SL.state.all || []).find((x) => String(x.id) === String(id));

  /* launches for a site key; 'all' returns every U.S. upcoming launch */
  L.bySite = function (key) {
    if (key === 'all') return SL.state.launches.slice();
    return SL.state.launches.filter((l) => l._site === key);
  };

  /* ---------- HERO (featured: next Space Coast launch) ------ */

  function renderHero() {
    const next = L.bySite('space-coast')[0];
    const eyebrow = $('#hero-eyebrow'), mission = $('#hero-mission'),
          vehicle = $('#hero-vehicle'), meta = $('#hero-meta'),
          cd = $('#hero-countdown'), watch = $('#hero-watch'),
          details = $('#hero-details'), remind = $('#hero-remind');

    if (!next) {
      eyebrow.textContent = 'No Space Coast launches on the manifest right now';
      mission.textContent = 'Clear skies';
      vehicle.textContent = 'Check the other U.S. launch sites — someone is always flying';
      meta.textContent = 'Live data from The Space Devs';
      cd.removeAttribute('data-net');
      details.disabled = true;
      return;
    }

    const nm = U.splitName(next.name);
    const prov = (next.launch_service_provider && next.launch_service_provider.name) || 'Unknown provider';
    const pad = (next.pad && next.pad.name) || 'TBD pad';
    const st = U.status(next);

    eyebrow.textContent = 'Next launch from the Space Coast · ' + st.label;
    mission.textContent = nm.mission;
    vehicle.textContent = nm.vehicle || prov;
    meta.textContent = prov + '  ·  ' + pad + '  ·  ' + U.fmtDateTime(next.net);
    cd.setAttribute('data-net', new Date(next.net).getTime());

    const wc = U.webcast(next);
    if (wc) { watch.hidden = false; watch.href = wc; } else { watch.hidden = true; }

    details.disabled = false;
    details.onclick = () => L.openModalById(next.id);
    remind.onclick = () => { SL.app.go('reminders'); SL.reminders.preselect(next.id); };
  }

  /* ---------- HOME: ON THE PAD (Space Coast) ---------------- */

  function renderUpnext() {
    const box = $('#home-upnext');
    if (!box) return;
    const items = L.bySite('space-coast').slice(0, 4);
    if (!items.length) { box.innerHTML = '<p class="empty">No upcoming Space Coast launches found.</p>'; return; }
    box.innerHTML = items.map((lc) => {
      const nm = U.splitName(lc.name);
      const d = new Date(lc.net);
      const prov = (lc.launch_service_provider && lc.launch_service_provider.name) || '';
      return '<button class="un-row" data-id="' + U.esc(lc.id) + '">' +
        '<div class="un-row__when"><b>' + d.getDate() + '</b>' +
          d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() + '</div>' +
        '<div class="un-row__body">' +
          '<div class="un-row__name">' + U.esc(nm.mission) + '</div>' +
          '<div class="un-row__sub">' + U.esc((nm.vehicle || prov) + ' · ' + U.fmtTime(lc.net)) + '</div>' +
        '</div></button>';
    }).join('');
    $$('.un-row', box).forEach((r) => r.onclick = () => L.openModalById(r.dataset.id));
  }

  /* ---------- HOME: LAUNCHING ACROSS AMERICA ---------------- */

  function renderUSAStrip() {
    const box = $('#home-usa');
    if (!box) return;
    const cards = [];
    SL.sites.forEach((s) => {
      if (s.key === 'space-coast') return;
      const list = L.bySite(s.key);
      if (!list.length) return;
      const next = list[0];
      const nm = U.splitName(next.name);
      cards.push(
        '<a class="usa-card" href="#site/' + s.key + '">' +
          '<div class="usa-card__top"><span class="usa-card__icon">' + s.icon + '</span>' +
            '<span class="usa-card__n">' + list.length + ' upcoming</span></div>' +
          '<div class="usa-card__name">' + U.esc(s.short) + '</div>' +
          '<div class="usa-card__place">' + U.esc(s.region) + '</div>' +
          '<div class="usa-card__next"><span>Next</span> ' + U.esc(nm.mission) +
            ' · ' + U.esc(U.fmtDateShort(next.net)) + '</div>' +
        '</a>');
    });
    box.innerHTML = cards.length
      ? '<div class="usa-grid">' + cards.join('') +
        '<a class="usa-card usa-card--all" href="#site/all">' +
          '<div class="usa-card__top"><span class="usa-card__icon">🇺🇸</span></div>' +
          '<div class="usa-card__name">All U.S. Launches</div>' +
          '<div class="usa-card__place">Every spaceport, one list</div>' +
          '<div class="usa-card__next">' + SL.state.launches.length + ' launches on the manifest →</div>' +
        '</a></div>'
      : '<p class="empty">No other U.S. launches on the manifest right now.</p>';
  }

  /* ---------- CALENDAR (all U.S., Space Coast highlighted) --- */

  function initCalendar() {
    const now = new Date();
    if (calYear == null) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
    $('#cal-prev').onclick  = () => shiftMonth(-1);
    $('#cal-next').onclick  = () => shiftMonth(1);
    $('#cal-today').onclick = () => { calYear = now.getFullYear(); calMonth = now.getMonth(); renderCalendar(); };
    $$('#cal-scope .chip').forEach((c) => {
      c.onclick = () => {
        $$('#cal-scope .chip').forEach((x) => x.classList.remove('chip--on'));
        c.classList.add('chip--on');
        calScope = c.dataset.scope;
        renderCalendar();
      };
    });
    renderCalendar();
  }

  function shiftMonth(d) {
    calMonth += d;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  }

  function renderCalendar() {
    const grid = $('#cal-grid');
    if (!grid) return;
    $('#cal-month').textContent = new Date(calYear, calMonth, 1)
      .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const first = new Date(calYear, calMonth, 1);
    const lead = first.getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    let source = SL.state.all || [];
    if (calScope === 'space-coast') source = source.filter((l) => l._site === 'space-coast');

    const byDay = {};
    source.forEach((lc) => {
      const d = new Date(lc.net);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        (byDay[d.getDate()] = byDay[d.getDate()] || []).push(lc);
      }
    });

    let html = '';
    for (let i = 0; i < lead; i++) html += '<div class="cal-cell cal-cell--empty"></div>';

    for (let day = 1; day <= days; day++) {
      const evts = (byDay[day] || []).sort((a, b) => new Date(a.net) - new Date(b.net));
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
      let cls = 'cal-cell';
      if (isToday) cls += ' cal-cell--today';
      if (evts.length) cls += ' cal-cell--has';

      html += '<div class="' + cls + '"><span class="cal-cell__num">' + day + '</span>';
      evts.slice(0, 3).forEach((lc) => {
        const nm = U.splitName(lc.name);
        const coast = lc._site === 'space-coast' ? ' cal-evt--coast' : '';
        html += '<div class="cal-evt cal-evt--' + U.calKind(lc) + coast + '" data-id="' +
          U.esc(lc.id) + '" title="' + U.esc(nm.mission) + '">' + U.esc(nm.mission) + '</div>';
      });
      if (evts.length > 3) html += '<span class="cal-evt__more">+' + (evts.length - 3) + ' more</span>';
      html += '</div>';
    }

    const trail = (7 - ((lead + days) % 7)) % 7;
    for (let i = 0; i < trail; i++) html += '<div class="cal-cell cal-cell--empty"></div>';

    grid.innerHTML = html;
    $$('.cal-evt', grid).forEach((e) => e.onclick = () => L.openModalById(e.dataset.id));
  }

  /* ---------- shared launch card + list --------------------- */

  function launchCard(lc, showSite) {
    const nm = U.splitName(lc.name);
    const st = U.status(lc);
    const prov = (lc.launch_service_provider && lc.launch_service_provider.name) || '';
    const pad = (lc.pad && lc.pad.name) || 'TBD pad';
    const site = U.site(lc._site);
    const img = lc.image ? ' style="background-image:url(' + U.esc(lc.image) + ')"' : '';
    const sub = [nm.vehicle, prov, (showSite && site) ? site.short : pad]
      .filter(Boolean).join('  ·  ');
    return '<article class="lc" data-id="' + U.esc(lc.id) + '">' +
      '<div class="lc__img"' + img + '></div>' +
      '<div class="lc__body">' +
        '<p class="lc__date">' + U.esc(U.fmtDate(lc.net) + ' · ' + U.fmtTime(lc.net)) + '</p>' +
        '<h3 class="lc__name">' + U.esc(nm.mission) + '</h3>' +
        '<p class="lc__sub">' + U.esc(sub) + '</p>' +
        '<span class="tag ' + st.cls + '">' + U.esc(st.label) + '</span>' +
      '</div>' +
      '<div class="lc__cd" data-net="' + new Date(lc.net).getTime() + '">' +
        '<b>' + U.cdLabel(new Date(lc.net) - Date.now()) + '</b><small>until liftoff</small>' +
      '</div></article>';
  }

  function renderLaunchList(box, items, showSite, emptyMsg) {
    if (!items.length) { box.innerHTML = '<p class="empty">' + emptyMsg + '</p>'; return; }
    box.innerHTML = items.map((lc) => launchCard(lc, showSite)).join('');
    $$('.lc', box).forEach((c) => c.onclick = () => L.openModalById(c.dataset.id));
  }

  /* ---------- LAUNCH SITES — directory ---------------------- */

  L.renderSitesDirectory = function () {
    const feat = $('#sites-featured'), gridBox = $('#sites-grid');
    if (!feat || !gridBox) return;

    if (!SL.state.launches.length && !(SL.state.all || []).length) {
      feat.innerHTML = '<div class="spinner"></div>';
      gridBox.innerHTML = '';
      return;
    }

    /* featured Space Coast card */
    const sc = U.site('space-coast');
    const scList = L.bySite('space-coast');
    const scNext = scList.slice(0, 3).map((lc) => {
      const nm = U.splitName(lc.name);
      return '<button class="site-mini" data-id="' + U.esc(lc.id) + '">' +
        '<span class="site-mini__date">' + U.esc(U.fmtDateShort(lc.net)) + '</span>' +
        '<span class="site-mini__name">' + U.esc(nm.mission) + '</span></button>';
    }).join('');

    feat.innerHTML =
      '<article class="site-feature">' +
        '<div class="site-feature__badge">★ Featured · Our Home Base</div>' +
        '<div class="site-feature__icon">' + sc.icon + '</div>' +
        '<h2 class="site-feature__name">' + U.esc(sc.name) + '</h2>' +
        '<p class="site-feature__place">' + U.esc(sc.place) + '</p>' +
        '<p class="site-feature__blurb">' + U.esc(sc.blurb) + '</p>' +
        '<div class="site-feature__stat"><b>' + scList.length + '</b> launches scheduled</div>' +
        (scNext ? '<div class="site-mini__list">' + scNext + '</div>' : '') +
        '<a class="btn btn--primary" href="#site/space-coast">Explore the Space Coast →</a>' +
      '</article>';

    /* every other site + an "all U.S." card */
    const cards = SL.sites.filter((s) => s.key !== 'space-coast').map((s) => {
      const list = L.bySite(s.key);
      const next = list[0];
      const nextLine = next
        ? 'Next: ' + U.esc(U.splitName(next.name).mission) + ' · ' + U.esc(U.fmtDateShort(next.net))
        : 'No launches currently scheduled';
      return '<a class="site-card" href="#site/' + s.key + '">' +
        '<div class="site-card__head"><span class="site-card__icon">' + s.icon + '</span>' +
          '<span class="site-card__n">' + list.length + '</span></div>' +
        '<h3 class="site-card__name">' + U.esc(s.name) + '</h3>' +
        '<p class="site-card__place">' + U.esc(s.place) + '</p>' +
        '<p class="site-card__blurb">' + U.esc(s.blurb) + '</p>' +
        '<p class="site-card__next">' + nextLine + '</p>' +
      '</a>';
    }).join('');

    gridBox.innerHTML = cards +
      '<a class="site-card site-card--all" href="#site/all">' +
        '<div class="site-card__head"><span class="site-card__icon">🇺🇸</span>' +
          '<span class="site-card__n">' + SL.state.launches.length + '</span></div>' +
        '<h3 class="site-card__name">All U.S. Launches</h3>' +
        '<p class="site-card__place">Every spaceport in one chronological list</p>' +
        '<p class="site-card__blurb">See the complete United States launch manifest, ' +
          'from Florida to Alaska, in the order they fly.</p>' +
        '<p class="site-card__next">View the full manifest →</p>' +
      '</a>';

    $$('.site-mini', feat).forEach((b) => b.onclick = (e) => {
      e.preventDefault(); L.openModalById(b.dataset.id);
    });
  };

  /* ---------- LAUNCH SITES — single site sub-page ----------- */

  L.renderSitePage = function (key) {
    const box = $('#site-page');
    if (!box) return;

    if (!SL.state.launches.length && !(SL.state.all || []).length) {
      box.innerHTML = '<div class="spinner"></div>';
      return;
    }

    const isAll = (key === 'all');
    const site = isAll ? null : U.site(key);
    if (!isAll && !site) {            /* unknown key — bounce to directory */
      SL.app.go('sites');
      return;
    }

    const list = L.bySite(isAll ? 'all' : key);
    const icon = isAll ? '🇺🇸' : site.icon;
    const name = isAll ? 'All U.S. Launches' : site.name;
    const place = isAll ? 'Every United States spaceport' : site.place;
    const blurb = isAll
      ? 'The complete United States launch manifest — every mission from every U.S. spaceport, in the order they lift off.'
      : site.blurb;
    const next = list[0];

    let head =
      '<a class="site-back" href="#sites">← All launch sites</a>' +
      '<div class="site-hero">' +
        '<div class="site-hero__icon">' + icon + '</div>' +
        '<div>' +
          '<h1 class="site-hero__name">' + U.esc(name) + '</h1>' +
          '<p class="site-hero__place">' + U.esc(place) + '</p>' +
        '</div>' +
        (next
          ? '<div class="site-hero__cd"><span>Next launch</span>' +
            '<b class="site-cd" data-net="' + new Date(next.net).getTime() + '">--:--:--</b></div>'
          : '') +
      '</div>' +
      '<p class="site-hero__blurb">' + U.esc(blurb) + '</p>';

    if (!isAll && site.viewing) {
      head += '<div class="site-viewing">' +
        '<h3>📍 Where to watch</h3><p>' + U.esc(site.viewing) + '</p></div>';
    }

    head += '<h2 class="site-list-title">' +
      (list.length ? list.length + ' Upcoming Launch' + (list.length === 1 ? '' : 'es') : 'Upcoming Launches') +
      '</h2><div class="launch-list" id="site-launch-list"></div>';

    box.innerHTML = head;
    renderLaunchList($('#site-launch-list'), list, isAll,
      'No launches are currently on the manifest for this site. Schedules shift constantly — check back soon.');
    SL.app.tick();
  };

  /* ---------- DETAIL MODAL ---------------------------------- */

  L.openModalById = function (id) {
    const lc = L.find(id);
    if (lc) openModal(lc);
  };

  function fact(label, value) {
    if (!value) return '';
    return '<div class="m-fact"><span>' + U.esc(label) + '</span><b>' + U.esc(value) + '</b></div>';
  }

  function openModal(lc) {
    const nm = U.splitName(lc.name);
    const st = U.status(lc);
    const prov = (lc.launch_service_provider && lc.launch_service_provider.name) || 'Unknown';
    const rocket = (lc.rocket && lc.rocket.configuration &&
      (lc.rocket.configuration.full_name || lc.rocket.configuration.name)) || nm.vehicle || '—';
    const pad = (lc.pad && lc.pad.name) || 'TBD';
    const loc = (lc.pad && lc.pad.location && lc.pad.location.name) || '';
    const site = U.site(lc._site);
    const orbit = (lc.mission && lc.mission.orbit && lc.mission.orbit.name) || '';
    const type = (lc.mission && lc.mission.type) || '';
    const desc = (lc.mission && lc.mission.description) ||
      'No mission briefing has been published for this flight yet. Details are typically released by the launch provider in the days before liftoff.';
    const wc = U.webcast(lc);
    const past = new Date(lc.net).getTime() < Date.now();

    let windowStr = U.fmtDateTime(lc.net);
    if (lc.window_start && lc.window_end && lc.window_start !== lc.window_end) {
      windowStr = U.fmtDate(lc.net) + ' · ' + U.fmtTime(lc.window_start) + ' – ' + U.fmtTime(lc.window_end);
    }
    const weather = (lc.probability != null && lc.probability >= 0) ? lc.probability + '% favorable' : '';
    const heroImg = lc.image ? ' style="background-image:url(' + U.esc(lc.image) + ')"' : '';

    const cdBlock = past ? '' :
      '<div class="m-cd" data-net="' + new Date(lc.net).getTime() + '">' +
        '<div><b data-cd="d">--</b><small>days</small></div>' +
        '<div><b data-cd="h">--</b><small>hours</small></div>' +
        '<div><b data-cd="m">--</b><small>min</small></div>' +
        '<div><b data-cd="s">--</b><small>sec</small></div>' +
      '</div>';

    $('#modal-body').innerHTML =
      '<div class="m-hero"' + heroImg + '></div>' +
      '<div class="m-pad">' +
        '<p class="m-eyebrow">' + U.esc(prov + (nm.vehicle ? '  ·  ' + nm.vehicle : '')) + '</p>' +
        '<h2 class="m-title" id="modal-title">' + U.esc(nm.mission) + '</h2>' +
        '<span class="tag ' + st.cls + '">' + U.esc(st.label) + '</span>' +
        cdBlock +
        '<div class="m-grid">' +
          fact('Launch window', windowStr) +
          fact('Rocket', rocket) +
          fact('Launch site', site ? site.name : '') +
          fact('Pad', pad) +
          fact('Location', loc) +
          fact('Target orbit', orbit) +
          fact('Mission type', type) +
          fact('Weather odds', weather) +
        '</div>' +
        '<p class="m-desc">' + U.esc(desc) + '</p>' +
        '<div class="m-actions">' +
          (wc ? '<a class="btn btn--primary" target="_blank" rel="noopener" href="' +
                U.esc(wc) + '">▶ Watch Live</a>' : '') +
          (past ? '' :
            '<button class="btn btn--ghost" data-act="ics">↓ Add to Calendar</button>' +
            '<button class="btn btn--ghost" data-act="remind">◷ Remind Me</button>' +
            (site ? '<a class="btn btn--ghost" href="#site/' + site.key + '" data-act="site">' +
                    site.icon + ' ' + U.esc(site.short) + '</a>' : '')) +
        '</div>' +
      '</div>';

    const ics = $('#modal-body [data-act="ics"]');
    if (ics) ics.onclick = () => SL.reminders.downloadICS(lc);
    const rm = $('#modal-body [data-act="remind"]');
    if (rm) rm.onclick = () => { closeModal(); SL.app.go('reminders'); SL.reminders.preselect(lc.id); };
    const sb = $('#modal-body [data-act="site"]');
    if (sb) sb.onclick = () => closeModal();

    SL.app.tick();
    $('#modal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  L.closeModal = closeModal;

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

})(window.SL);
