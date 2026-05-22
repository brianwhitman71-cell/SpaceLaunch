/* ============================================================
   SPACE LAUNCH — app: starfield, routing, countdown ticker, boot
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$, $$ = U.$$;
  const A = SL.app = {};

  const VIEWS = ['home', 'calendar', 'sites', 'site', 'live', 'stations', 'news', 'reminders'];
  A.current = { view: 'home', param: '' };

  /* ---------- starfield canvas ------------------------------ */

  function starfield() {
    const cv = $('#starfield'), ctx = cv.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars = [], shoot = null, w, h;

    function resize() {
      w = cv.width = window.innerWidth;
      h = cv.height = window.innerHeight;
      const count = Math.round((w * h) / 9000);
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 1.4 + 0.2,
          a: Math.random() * 0.5 + 0.3,
          tw: Math.random() * 0.02 + 0.004,
          ph: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.15 ? 200 : (Math.random() < 0.5 ? 280 : 0)
        });
      }
    }
    window.addEventListener('resize', resize);
    resize();

    let t = 0;
    function frame() {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const al = reduced ? s.a : s.a + Math.sin(t * s.tw + s.ph) * 0.28;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fillStyle = s.hue
          ? 'hsla(' + s.hue + ',90%,80%,' + Math.max(0, al) + ')'
          : 'rgba(255,255,255,' + Math.max(0, al) + ')';
        ctx.fill();
      }
      if (!reduced) {
        if (!shoot && Math.random() < 0.004) {
          shoot = { x: Math.random() * w, y: Math.random() * h * 0.5,
                    len: 0, max: 90 + Math.random() * 120,
                    vx: 5 + Math.random() * 4, vy: 2 + Math.random() * 2 };
        }
        if (shoot) {
          const g = ctx.createLinearGradient(shoot.x, shoot.y,
            shoot.x - shoot.len, shoot.y - shoot.len * 0.45);
          g.addColorStop(0, 'rgba(180,230,255,.9)');
          g.addColorStop(1, 'rgba(180,230,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - shoot.len, shoot.y - shoot.len * 0.45);
          ctx.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy;
          shoot.len = Math.min(shoot.max, shoot.len + 14);
          if (shoot.x > w + 120 || shoot.y > h + 120) shoot = null;
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- countdown ticker ------------------------------ */

  function setGroup(box, ms) {
    const c = U.countdown(ms);
    const put = (k, v) => {
      const el = box.querySelector('[data-cd="' + k + '"]');
      if (el) el.textContent = U.pad2(v);
    };
    put('d', c.d); put('h', c.h); put('m', c.m); put('s', c.s);
    return c;
  }

  function tMinus(ms) {
    const c = U.countdown(ms);
    if (c.done) return 'T-00:00:00';
    const core = U.pad2(c.h) + ':' + U.pad2(c.m) + ':' + U.pad2(c.s);
    return 'T-' + (c.d > 0 ? c.d + 'd ' : '') + core;
  }

  A.tick = function () {
    const now = Date.now();

    const hero = $('#hero-countdown');
    if (hero && hero.dataset.net) {
      const c = setGroup(hero, +hero.dataset.net - now);
      hero.classList.toggle('is-lift', c.done);
    }
    $$('.lc__cd[data-net]').forEach((el) => {
      const b = el.querySelector('b');
      if (b) b.textContent = U.cdLabel(+el.dataset.net - now);
    });
    const mcd = $('.m-cd[data-net]');
    if (mcd) setGroup(mcd, +mcd.dataset.net - now);

    $$('.ln__cd[data-net]').forEach((el) => { el.textContent = tMinus(+el.dataset.net - now); });
    $$('.site-cd[data-net]').forEach((el) => { el.textContent = tMinus(+el.dataset.net - now); });
    $$('[data-tk-net]').forEach((el) => { el.textContent = U.cdLabel(+el.dataset.tkNet - now); });
  };

  /* ---------- routing --------------------------------------- */

  function show(view, param) {
    if (VIEWS.indexOf(view) === -1) { view = 'home'; param = ''; }
    A.current = { view: view, param: param || '' };

    VIEWS.forEach((v) => {
      const sec = $('#view-' + v);
      if (sec) sec.classList.toggle('view--active', v === view);
    });
    const navKey = (view === 'site') ? 'sites' : view;
    $$('#nav-links a').forEach((a) => a.classList.toggle('is-on', a.dataset.view === navKey));
    document.body.dataset.view = view;
    $('#nav-links').classList.remove('is-open');
    $('#nav-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (view === 'sites')    SL.launches.renderSitesDirectory();
    if (view === 'site')     SL.launches.renderSitePage(param || 'all');
    if (view === 'live')     { SL.live.ensureMap(); SL.live.renderNow(); }
    if (view === 'stations') SL.stations.start(); else SL.stations.stop();
  }

  function route() {
    const raw = (location.hash || '#home').slice(1);
    const i = raw.indexOf('/');
    const view = i === -1 ? raw : raw.slice(0, i);
    const param = i === -1 ? '' : raw.slice(i + 1);
    show(view, param);
  }

  A.go = function (target) {
    if (location.hash === '#' + target) route();
    else location.hash = '#' + target;
  };

  /* ---------- boot ------------------------------------------ */

  function refreshActive() {
    if (A.current.view === 'sites') SL.launches.renderSitesDirectory();
    if (A.current.view === 'site')  SL.launches.renderSitePage(A.current.param || 'all');
  }

  function loadLaunches() {
    return SL.launches.load().then(function () {
      SL.reminders.populateLaunches();
      SL.live.renderNow();
      SL.live.renderRecent();
      refreshActive();
      A.tick();
    });
  }

  function boot() {
    starfield();

    window.addEventListener('hashchange', route);
    route();

    $('#nav-toggle').onclick = function () {
      const links = $('#nav-links');
      const open = links.classList.toggle('is-open');
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    SL.reminders.init();
    SL.stations.render();
    SL.ticker.init();
    const moreBtn = $('#news-more');
    if (moreBtn) moreBtn.onclick = SL.news.loadMore;

    A.tick();
    setInterval(A.tick, 1000);

    loadLaunches();
    SL.news.load();
    SL.live.start();                         /* app-wide ISS position polling */

    setInterval(loadLaunches, 30 * 60 * 1000); /* keep launch data fresh */
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.SL);
