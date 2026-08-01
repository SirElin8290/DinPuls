const newsState = window.DinPulsMunicipalityState;
let newsMunicipality = newsState.getInitial();
let newsPageData = { articles: [], sources: [] };
let newsPageScope = "local";

const newsEscape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function initializeNewsPage() {
  const municipalitySelect = document.querySelector("#news-municipality");
  newsState.populateSelect(municipalitySelect, newsMunicipality);
  municipalitySelect.addEventListener("change", () => {
    newsMunicipality = newsState.set(municipalitySelect.value);
    renderNewsPage();
  });
  document.querySelectorAll("[data-page-scope]").forEach(button => button.addEventListener("click", () => {
    newsPageScope = button.dataset.pageScope;
    document.querySelectorAll("[data-page-scope]").forEach(item => item.classList.toggle("active", item === button));
    renderNewsPage();
  }));
  document.querySelector("#news-page-search").addEventListener("input", renderNewsPage);
  document.querySelector("#news-page-access").addEventListener("change", renderNewsPage);
  renderNewsAds();
  const response = await fetch(`data/news.json?version=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Nyhetsdata svarade ${response.status}`);
  newsPageData = await response.json();
  renderNewsPage();
}

function newsLocalMatch(article) {
  return (article.municipalities || []).includes(newsMunicipality) || (article.municipalities || []).includes("Alla");
}

function newsPageScore(article) {
  const age = Math.max(0, (Date.now() - new Date(article.publishedAt).getTime()) / 3600000);
  return (Number(article.quality) || 70) * .45 + (Number(article.impact) || 40) * .35 + Math.max(0, 40 - age / 4) * .2 + (article.important ? 15 : 0);
}

function renderNewsPage() {
  document.querySelectorAll("[data-news-municipality]").forEach(el => el.textContent = newsMunicipality);
  document.title = `Nyheter i ${newsMunicipality} – DinPuls`;
  const query = document.querySelector("#news-page-search").value.trim().toLocaleLowerCase("sv-SE");
  const access = document.querySelector("#news-page-access").value;
  let articles = (newsPageData.articles || []).filter(article => article.scope === newsPageScope);
  if (newsPageScope === "local") articles = articles.filter(newsLocalMatch);
  articles = articles.filter(article => access === "all" || article.access === access)
    .filter(article => !query || `${article.title} ${article.summary} ${article.source}`.toLocaleLowerCase("sv-SE").includes(query))
    .sort((a, b) => newsPageScore(b) - newsPageScore(a) || new Date(b.publishedAt) - new Date(a.publishedAt));
  const list = document.querySelector("#news-page-list");
  list.innerHTML = articles.map(renderNewsPageArticle).join("");
  list.hidden = !articles.length;
  document.querySelector("#news-page-empty").hidden = Boolean(articles.length);
  document.querySelector("#news-page-total").textContent = `${articles.length} ${articles.length === 1 ? "aktuell nyhet" : "aktuella nyheter"}`;
  const generated = new Date(newsPageData.generatedAt || "");
  document.querySelector("#news-page-updated").textContent = Number.isNaN(generated.getTime()) ? "" : `Uppdaterad ${generated.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  renderNewsPageImportant(articles);
  renderNewsPageSources();
  if (window.lucide) lucide.createIcons();
}

function renderNewsPageArticle(article) {
  const locked = article.access === "subscription";
  const published = new Date(article.publishedAt);
  return `<article class="news-page-card ${article.important ? "important" : ""}"><div class="news-page-card-meta"><strong>${newsEscape(article.source)}</strong><time>${Number.isNaN(published.getTime()) ? "" : published.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><h2>${newsEscape(article.title)}</h2><p>${newsEscape(article.summary || "")}</p><div class="news-page-card-footer"><span class="news-access ${locked ? "subscription" : "free"}"><i data-lucide="${locked ? "lock" : "unlock"}"></i>${locked ? "Låst artikel" : "Fri artikel"}</span><span>${newsEscape(article.category || article.region || "Nyhet")}</span><a href="${newsEscape(article.url)}" target="_blank" rel="noopener noreferrer">Läs hos ${newsEscape(article.source)} <i data-lucide="arrow-up-right"></i></a></div></article>`;
}

function renderNewsPageImportant(articles) {
  const box = document.querySelector("#news-page-important");
  const important = articles.filter(article => article.important || Number(article.impact) >= 85).slice(0, 3);
  box.hidden = !important.length;
  box.innerHTML = important.length ? `<h2><i data-lucide="triangle-alert"></i> Viktiga lokala händelser</h2>${important.map(article => `<a href="${newsEscape(article.url)}" target="_blank" rel="noopener noreferrer"><strong>${newsEscape(article.title)}</strong><span>${newsEscape(article.source)}</span></a>`).join("")}` : "";
}

function renderNewsPageSources() {
  const sources = (newsPageData.sources || []).filter(source => source.scope === newsPageScope && (newsPageScope !== "local" || (source.municipalities || []).includes(newsMunicipality)));
  document.querySelector("#news-page-sources").innerHTML = sources.map(source => `<a href="${newsEscape(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${newsEscape(source.name)}</strong><span>${newsEscape(source.type)}</span><small><i data-lucide="${source.access === "subscription" ? "lock" : "check"}"></i>${source.access === "subscription" ? "Delvis låst" : "Fri"}</small></a>`).join("");
}

function renderNewsAds() {
  document.querySelectorAll("[data-strategic-ad]").forEach(slot => {
    const position = slot.dataset.adPosition;
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20nyheter%20${position}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls nyhetssida · 500 kr/mån</small></a>`;
  });
}

initializeNewsPage().catch(error => {
  console.error(error);
  document.querySelector("#news-page-total").textContent = "Nyheterna kunde inte laddas";
  document.querySelector("#news-page-empty").hidden = false;
});
