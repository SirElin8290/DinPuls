/* DinPuls: använd en tydlig nyhetsikon i artikelkort i stället för källinitialer. */
(function () {
  function applyNewsIcons(root = document) {
    root.querySelectorAll?.('.news-item .news-source-mark').forEach((mark) => {
      if (mark.dataset.newsIconApplied === 'true') return;
      mark.textContent = '';
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'newspaper');
      icon.setAttribute('aria-hidden', 'true');
      mark.appendChild(icon);
      mark.dataset.newsIconApplied = 'true';
    });
    if (window.lucide) window.lucide.createIcons();
  }

  const style = document.createElement('style');
  style.textContent = `
    .news-item .news-source-mark{
      display:grid;
      place-items:center;
    }
    .news-item .news-source-mark svg{
      width:20px;
      height:20px;
      stroke-width:2;
    }
  `;
  document.head.appendChild(style);

  applyNewsIcons();

  const feed = document.querySelector('#news-feed');
  if (feed) {
    new MutationObserver(() => applyNewsIcons(feed)).observe(feed, { childList: true, subtree: true });
  }

  document.addEventListener('dinpuls:municipalitychange', () => applyNewsIcons());
})();
