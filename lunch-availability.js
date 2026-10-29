(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DinPulsLunchAvailability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function weekKey(value) {
    const stamp = new Date(value);
    if (!Number.isFinite(stamp.getTime())) return null;
    const local = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit"}).format(stamp);
    const day = new Date(local + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const year = day.getUTCFullYear();
    const week = Math.ceil((((day - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return {year, week};
  }
  function dishes(days) { return Object.values(days || {}).some(items => Array.isArray(items) && items.length); }
  function isPublic(item, now = new Date()) {
    if (item?.status === "standing_menu") return Array.isArray(item.standingDishes) && item.standingDishes.length > 0;
    if (item?.status === "upcoming") {
      const start = Date.parse(item.upcomingMenu?.validFrom);
      const today = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
      return Number.isFinite(start) && item.upcomingMenu.validFrom > today && Boolean(dishes(item.upcomingMenu.days) || item.upcomingMenu.image);
    }
    if (item?.status !== "current") return false;
    const current = weekKey(now), verified = weekKey(item.checkedAt);
    return Boolean(current && verified && current.year === verified.year && current.week === verified.week && item.weekNumber === current.week && (dishes(item.days) || item.verifiedMenuImage));
  }
  return Object.freeze({isPublic, weekKey});
});
