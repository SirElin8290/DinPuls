(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DinPulsEnergy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function validNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  function normalizePeriods(periods) {
    if (!Array.isArray(periods)) return [];
    return periods.map(item => ({ start: item?.start, end: item?.end, orePerKwh: validNumber(item?.orePerKwh) }))
      .filter(item => item.start && item.end && item.orePerKwh !== null && Number.isFinite(Date.parse(item.start)) && Number.isFinite(Date.parse(item.end)) && Date.parse(item.end) > Date.parse(item.start));
  }
  function summarize(areaData, now = new Date()) {
    const periods = normalizePeriods(areaData?.periods);
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (!periods.length || !Number.isFinite(nowMs)) return null;
    const current = periods.find(item => Date.parse(item.start) <= nowMs && nowMs < Date.parse(item.end));
    if (!current) return null;
    const cheapest = periods.reduce((best, item) => item.orePerKwh < best.orePerKwh ? item : best, periods[0]);
    const values = periods.map(item => item.orePerKwh);
    return { current, cheapest, minimum: Math.min(...values), maximum: Math.max(...values), periods };
  }
  function areaForMunicipality(mapping, municipality) {
    const area = mapping?.municipalities?.[municipality];
    return /^SE[1-4]$/.test(area || "") ? area : null;
  }
  return Object.freeze({ normalizePeriods, summarize, areaForMunicipality });
});
