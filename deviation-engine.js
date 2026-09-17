(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DinPulsDeviationEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalize(item) {
    if (!item || !["general", "specific"].includes(item.scope)) return null;
    const validFrom = new Date(item.validFrom || item.valid_from || "");
    const validUntil = new Date(item.validUntil || item.valid_until || "");
    if (!item.title || Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime()) || validUntil < validFrom) return null;
    return { ...item, validFrom: validFrom.toISOString(), validUntil: validUntil.toISOString() };
  }

  function activeItems(items, now = new Date(), leadTimeDays = 14) {
    const timestamp = new Date(now).getTime();
    const lead = Math.max(0, Number(leadTimeDays) || 0) * 86400000;
    return (Array.isArray(items) ? items : [])
      .map(normalize)
      .filter(Boolean)
      .filter(item => timestamp >= new Date(item.validFrom).getTime() - lead && timestamp <= new Date(item.validUntil).getTime())
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.validFrom) - new Date(b.validFrom));
  }

  return { normalize, activeItems };
});
