/* ============================================================
   SPACE LAUNCH — live ticker: a scrolling banner across the top
   with the next launches, fresh space news, and Cape Canaveral
   weather. Pauses on hover; launch items open the flight card.
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$;
  const T = SL.ticker = {};

  /* WMO weather code -> [icon, description] */
  const WMO = {
    0: ['☀️', 'Clear sky'],      1: ['🌤️', 'Mainly clear'],
    2: ['⛅', 'Partly cloudy'],   3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'],           48: ['🌫️', 'Freezing fog'],
    51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'],        55: ['🌦️', 'Heavy drizzle'],
    56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'],
    61: ['🌧️', 'Light rain'],    63: ['🌧️', 'Rain'],           65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
    71: ['🌨️', 'Light snow'],    73: ['🌨️', 'Snow'],           75: ['🌨️', 'Heavy snow'],
    77: ['🌨️', 'Snow grains'],
    80: ['🌦️', 'Light showers'], 81: ['🌦️', 'Showers'],        82: ['⛈️', 'Violent showers'],
    85: ['🌨️', 'Snow showers'],  86: ['🌨️', 'Snow showers'],
    95: ['⛈️', 'Thunderstorm'],  96: ['⛈️', 'Thunderstorm, hail'], 99: ['⛈️', 'Thunderstorm, hail']
  };
  const wmo = (code) => WMO[code] || ['🛰️', 'Conditions unavailable'];

  /* ---------- weather ---------------------------------------- */

  async function loadWeather() {
    const c = SL.cfg;
    const url = c.weather + '?latitude=' + c.weatherLat + '&longitude=' + c.weatherLon +
      '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph';
    try {
      const d = await U.cachedJSON(url, c.ttl.weather);
      const cur = d.current || {};
      SL.state.weather = {
        temp: Math.round(cur.temperature_2m),
        wind: Math.round(cur.wind_speed_10m),
        humidity: Math.round(cur.relative_humidity_2m),
        code: cur.weather_code
      };
    } catch (e) { SL.state.weather = null; }
    T.build();
  }

  /* ---------- ticker items ----------------------------------- */

  function launchItem(lc, isNext) {
    const nm = U.splitName(lc.name);
    const site = U.site(lc._site);
    const net = new Date(lc.net).getTime();
    const label = isNext ? 'NEXT LAUNCH' : (site ? site.short : 'Launch');
    return '<button class="tk-item tk-item--launch' + (isNext ? ' tk-item--next' : '') +
        '" data-tk-launch="' + U.esc(lc.id) + '">' +
      '<span class="tk-ico">🚀</span>' +
      '<b>' + U.esc(label) + '</b>' +
      '<span class="tk-txt">' + U.esc(nm.mission) + '</span>' +
      '<span class="tk-cd" data-tk-net="' + net + '">' +
        U.esc(U.cdLabel(net - Date.now())) + '</span>' +
    '</button>';
  }

  function newsItem(a) {
    return '<a class="tk-item tk-item--news" href="' + U.esc(a.url) +
        '" target="_blank" rel="noopener">' +
      '<span class="tk-ico">📰</span>' +
      '<b>' + U.esc(a.news_site || 'Space News') + '</b>' +
      '<span class="tk-txt">' + U.esc(a.title) + '</span>' +
    '</a>';
  }

  function weatherItem(w) {
    const m = wmo(w.code);
    return '<span class="tk-item tk-item--wx">' +
      '<span class="tk-ico">' + m[0] + '</span>' +
      '<b>Cape Canaveral</b>' +
      '<span class="tk-txt">' + w.temp + '°F · ' + U.esc(m[1]) +
        ' · wind ' + w.wind + ' mph · ' + w.humidity + '% humidity</span>' +
    '</span>';
  }

  /* ---------- build & render --------------------------------- */

  T.build = function () {
    const track = $('#ticker-track');
    if (!track) return;

    const launches = SL.state.launches || [];
    const news = SL.state.news || [];
    const w = SL.state.weather;
    const items = [];

    if (launches[0]) items.push(launchItem(launches[0], true));
    if (w) items.push(weatherItem(w));

    const moreL = launches.slice(1, 6);
    const moreN = news.slice(0, 6);
    const rounds = Math.max(moreL.length, moreN.length);
    for (let i = 0; i < rounds; i++) {
      if (moreN[i]) items.push(newsItem(moreN[i]));
      if (moreL[i]) items.push(launchItem(moreL[i], false));
    }

    if (!items.length) {
      track.innerHTML = '<div class="tk-set"><span class="tk-item tk-item--wx">' +
        'Tuning in to the latest from across U.S. spaceflight…</span></div>';
      return;
    }

    const sep = '<span class="tk-sep" aria-hidden="true">✦</span>';
    const set = items.join(sep) + sep;
    /* duplicate the set so the marquee loops seamlessly */
    track.innerHTML = '<div class="tk-set">' + set + '</div>' +
                      '<div class="tk-set" aria-hidden="true">' + set + '</div>';

    /* scroll speed ≈ 64 px / second */
    requestAnimationFrame(function () {
      const half = track.scrollWidth / 2;
      track.style.animationDuration = Math.max(24, Math.round(half / 64)) + 's';
    });

    if (SL.app && SL.app.tick) SL.app.tick();
  };

  /* ---------- init ------------------------------------------- */

  T.init = function () {
    const track = $('#ticker-track');
    if (track) {
      track.addEventListener('click', function (e) {
        const el = e.target.closest('[data-tk-launch]');
        if (el) SL.launches.openModalById(el.dataset.tkLaunch);
      });
    }
    T.build();
    loadWeather();
    setInterval(loadWeather, SL.cfg.ttl.weather * 60000);
  };

})(window.SL);
