/* DinPuls community feed
   Source-first local information from approved community groups.
   No scraping is performed here. Only curated, approved data is rendered. */

/* First-visit municipality UI is isolated so it can evolve without touching the main application bundle. */
(() => {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "first-visit.css?v=1";
  document.head.appendChild(style);
  const script = document.createElement("script");
  script.src = "first-visit.js?v=2";
  document.head.appendChild(script);
})();

/* Färgelandas verifierade evenemang måste även nå startsidans evenemangskort.
   Huvudflödet i data/events.json är fortfarande källan för övriga kommuner. */
(() => {
  if (document.querySelector('script[data-fargelanda-events-home]')) return;
  const script = document.createElement("script");
  script.src = "fargelanda-events-home.js?v=1";
  script.dataset.fargelandaEventsHome = "true";
  document.head.appendChild(script);
})();

(function initCommunityFeed(root) {
  "use strict";

  const Core = root.DinPulsCore;
  if (!Core) return;

  const state = { sources: [], posts: [] };

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function approvedSourcesFor(municipality) {
    return state.sources.filter(source =>
      source?.status === "approved" &&
      Array.isArray(source.municipalities) &&
      source.municipalities.includes(municipality)
    );
  }

  function postsFor(municipality) {
    const approved = new Set(approvedSourcesFor(municipality).map(source => source.id));
    return state.posts
      .filter(post => post?.moderationStatus === "approved")
      .filter(post => approved.has(post.sourceId))
      .filter(post => Array.isArray(post.municipalities) && post.municipalities.includes(municipality))
      .sort((a, b) => {
        const score = Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0);
        if (score) return score;
        return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      });
  }

  function card(post, source) {
    const href = Core.safeExternalUrl(post.originalUrl || "");
    const summary = Core.escapeHtml(post.summary || "");
    const sourceName = Core.escapeHtml(source?.name || "Lokal Facebook-grupp");
    const time = post.publishedAt ? Core.formatRelativeTime(post.publishedAt) : "";
    return `<article class="community-post-card">
      <div class="community-post-meta"><span>${sourceName}</span>${time ? `<time>${Core.escapeHtml(time)}</time>` : ""}</div>
      <p>${summary}</p>
      ${href ? `<a href="${Core.escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">Visa originalinlägg på Facebook <span aria-hidden="true">↗</span></a>` : ""}
    </article>`;
  }

  function render(municipality) {
    const section = document.getElementById("community-feed-section");
    const list = document.getElementById("community-feed-list");
    const allLink = document.getElementById("community-feed-all");
    if (!section || !list) return;

    const sources = approvedSourcesFor(municipality);
    const posts = postsFor(municipality).slice(0, 3);
    if (!sources.length || !posts.length) {
      section.hidden = true;
      list.replaceChildren();
      return;
    }

    const sourceMap = new Map(sources.map(source => [source.id, source]));
    list.innerHTML = posts.map(post => card(post, sourceMap.get(post.sourceId))).join("");
    section.hidden = false;
    if (allLink) allLink.href = `lokalt-flode.html?kommun=${encodeURIComponent(municipality)}`;
  }

  async function initialize() {
    try {
      const [sourceData, postData] = await Promise.all([
        loadJson("data/community-sources.json"),
        loadJson("data/community-posts.json")
      ]);
      state.sources = Array.isArray(sourceData.sources) ? sourceData.sources : [];
      state.posts = Array.isArray(postData.posts) ? postData.posts : [];
      const municipality = root.DinPulsMunicipalityState?.getInitial?.() || "Åmål";
      render(municipality);
      document.addEventListener("dinpuls:municipalitychange", event => {
        render(event.detail?.municipality?.name || municipality);
      });
    } catch (error) {
      console.error("Lokalt flöde kunde inte laddas:", error);
    }
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize, { once: true })
    : initialize();
})(window);
