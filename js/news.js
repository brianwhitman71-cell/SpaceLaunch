/* ============================================================
   SPACE LAUNCH — space news & discoveries (Spaceflight News API)
   ============================================================ */
(function (SL) {
  'use strict';
  const U = SL.util, $ = U.$;
  const N = SL.news = {};

  const PAGE = 12;
  let offset = 0, items = [], loading = false;

  function articleCard(a) {
    const img = a.image_url
      ? ' style="background-image:url(' + U.esc(a.image_url) + ')"' : '';
    return '<a class="na" href="' + U.esc(a.url) + '" target="_blank" rel="noopener">' +
      '<div class="na__img"' + img + '></div>' +
      '<div class="na__body">' +
        '<div class="na__meta">' +
          '<span class="na__site">' + U.esc(a.news_site || 'Space News') + '</span>' +
          '<span class="na__date">' + U.esc(U.fmtDateShort(a.published_at)) + '</span>' +
        '</div>' +
        '<h3 class="na__title">' + U.esc(a.title) + '</h3>' +
        '<p class="na__sum">' + U.esc(a.summary || '') + '</p>' +
        '<span class="na__read">Read the full story →</span>' +
      '</div></a>';
  }

  function renderGrid() {
    const grid = $('#news-grid');
    if (grid) grid.innerHTML = items.map(articleCard).join('');
  }

  function renderHomeTeaser() {
    const box = $('#home-news');
    if (!box) return;
    const top = items.slice(0, 3);
    if (!top.length) { box.innerHTML = '<p class="empty">News feed unavailable right now.</p>'; return; }
    box.innerHTML = top.map((a) => {
      const img = a.image_url ? ' style="background-image:url(' + U.esc(a.image_url) + ')"' : '';
      return '<a class="hn-card" href="' + U.esc(a.url) + '" target="_blank" rel="noopener">' +
        '<div class="hn-card__img"' + img + '></div>' +
        '<div class="hn-card__body">' +
          '<div class="hn-card__site">' + U.esc(a.news_site || 'Space News') + '</div>' +
          '<div class="hn-card__title">' + U.esc(a.title) + '</div>' +
        '</div></a>';
    }).join('');
  }

  async function fetchPage() {
    if (loading) return;
    loading = true;
    const url = SL.cfg.news + '/?limit=' + PAGE + '&offset=' + offset;
    try {
      const d = await U.cachedJSON(url, SL.cfg.ttl.news);
      items = items.concat(d.results || []);
      offset += PAGE;
      SL.state.news = items.slice();
      if (SL.ticker) SL.ticker.build();
      const more = $('#news-more');
      if (more) more.style.display = (d.next ? '' : 'none');
    } catch (e) {
      if (!items.length) {
        const grid = $('#news-grid');
        if (grid) grid.innerHTML = '<p class="empty">The deep-space antenna lost the news feed. ' +
          'Please try again shortly.</p>';
      }
      const more = $('#news-more');
      if (more) more.style.display = 'none';
    }
    loading = false;
  }

  N.load = async function () {
    await fetchPage();
    renderGrid();
    renderHomeTeaser();
  };

  N.loadMore = async function () {
    const btn = $('#news-more');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    await fetchPage();
    renderGrid();
    if (btn) { btn.disabled = false; btn.textContent = 'Load more stories'; }
  };

})(window.SL);
