(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.DinPulsLeisureCards = factory({
    escapeHtml: root.DinPulsSecurity.escapeHtml,
    safeExternalUrl: root.DinPulsSecurity.safeExternalUrl,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function createLeisureCards(options) {
  "use strict";

  const { escapeHtml, safeExternalUrl } = options;
  const esc = (value) => escapeHtml(String(value || ""));
  const safe = (value) => esc(safeExternalUrl(value));
  const list = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  const normalize = (value) => String(value || "").toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function searchableText(item) {
    return normalize([
      item.name,
      item.categoryLabel,
      item.type,
      item.activityType,
      item.location,
      item.description,
      ...list(item.targetAudience),
      ...list(item.tags),
      item.source?.label,
    ].join(" "));
  }

  function filterActivities(items, { query = "", category = "" } = {}) {
    const normalizedQuery = normalize(query);
    if (normalizedQuery) return items.filter((item) => searchableText(item).includes(normalizedQuery));
    if (category) return items.filter((item) => item.category === category);
    return items;
  }

  function detail(icon, label, value) {
    if (!value) return "";
    return `<span class="leisure-activity-detail"><i data-lucide="${icon}"></i><span><b>${esc(label)}</b>${esc(value)}</span></span>`;
  }

  function activityCard(item) {
    const icon = item.type === "Kommunal verksamhet" ? "landmark" : item.type === "Fritidsverksamhet" ? "sparkles" : "users";
    const audience = list(item.targetAudience).join(", ");
    const details = [
      detail("sparkles", "Aktivitet", item.activityType),
      detail("users", "Passar", audience),
      detail("map-pin", "Plats", item.location),
    ].join("");
    const tags = list(item.tags).slice(0, 4).map((tag) => `<span>${esc(tag)}</span>`).join("");
    const activityUrl = item.calendarUrl || item.activityUrl;
    const activityLabel = item.calendarUrl ? "Aktuell kalender" : "Aktuella aktiviteter";
    const source = item.source?.label
      ? `<span class="leisure-activity-source">Källa: ${item.source.url ? `<a href="${safe(item.source.url)}" target="_blank" rel="noopener noreferrer">${esc(item.source.label)}</a>` : esc(item.source.label)}</span>`
      : "";
    const actions = [
      `<a class="leisure-activity-primary" href="${safe(item.url)}" target="_blank" rel="noopener noreferrer">Läs mer <i data-lucide="external-link"></i></a>`,
      activityUrl && activityUrl !== item.url
        ? `<a href="${safe(activityUrl)}" target="_blank" rel="noopener noreferrer">${activityLabel} <i data-lucide="calendar-days"></i></a>`
        : "",
    ].join("");

    return `<article class="leisure-activity${item.description || details ? " leisure-activity-rich" : ""}">
      <div class="leisure-activity-heading"><span class="leisure-activity-mark"><i data-lucide="${icon}"></i></span><div><strong>${esc(item.name)}</strong><small>${item.municipality ? `${esc(item.municipality)} · ` : ""}${esc(item.categoryLabel)} · ${esc(item.type)}</small></div></div>
      ${item.description ? `<p>${esc(item.description)}</p>` : ""}
      ${details ? `<div class="leisure-activity-details">${details}</div>` : ""}
      ${tags ? `<div class="leisure-activity-tags" aria-label="Inriktningar">${tags}</div>` : ""}
      <footer><div class="leisure-activity-actions">${actions}</div>${source}</footer>
    </article>`;
  }

  return { activityCard, filterActivities, searchableText };
});
