(function (root) {
  "use strict";
  function rgb(value) {
    const parts = String(value).match(/[\d.]+/g);
    return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : null;
  }
  function luminance(color) {
    const channels = color.map(value => {
      const v = value / 255;
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function blend(foreground, background, alpha) {
    return foreground.map((value, i) => value * alpha + background[i] * (1 - alpha));
  }
  const api = { rgb, contrast, blend };
  if (typeof module !== "undefined") module.exports = api;
  if (!root.document) return;

  const document = root.document;
  const originals = new Map();
  let last = { repaired: [], skipped: 0, menuRepaired: false };
  let timer;
  function background(element) {
    const r = element.getBoundingClientRect();
    let color = [0, 0, 0], alpha = 0;
    for (let node = element; node; node = node.parentElement) {
      const style = root.getComputedStyle(node);
      // Photos, gradients and faded text need a visual review; never guess their pixels.
      if (style.backgroundImage !== "none" || Number(style.opacity) < 1) return null;
      if ([...node.children].some(child => {
        if (!child.matches("img,video,canvas")) return false;
        const image = child.getBoundingClientRect();
        return image.left <= r.left + r.width / 2 && image.right >= r.left + r.width / 2 &&
          image.top <= r.top + r.height / 2 && image.bottom >= r.top + r.height / 2;
      })) return null;
      const parts = style.backgroundColor.match(/[\d.]+/g);
      if (!parts || parts.length < 3) continue;
      const opacity = parts.length > 3 ? Number(parts[3]) : 1;
      const contribution = (1 - alpha) * opacity;
      color = color.map((v, i) => v + Number(parts[i]) * contribution);
      alpha += contribution;
      if (alpha >= .999) return color;
    }
    return null;
  }
  function repairMenu() {
    const panel = document.getElementById("notification-panel");
    if (!panel || panel.hidden) return false;
    const r = panel.getBoundingClientRect();
    const bad = root.getComputedStyle(panel).position !== "fixed" || r.left < 0 || r.right > root.innerWidth || r.top < 0 || r.bottom > root.innerHeight;
    if (!bad) return false;
    // Escape transformed/clipping header ancestors; existing listeners stay attached.
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    const bell = document.getElementById("notification-button")?.getBoundingClientRect();
    const top = Math.min(Math.max(8, (bell?.bottom || 48) + 8), Math.max(8, root.innerHeight - 100));
    panel.style.setProperty("position", "fixed", "important");
    panel.style.setProperty("left", "auto", "important");
    panel.style.setProperty("right", "8px", "important");
    panel.style.setProperty("top", `${top}px`, "important");
    panel.style.setProperty("width", "min(440px, calc(100vw - 16px))", "important");
    panel.style.setProperty("max-height", `calc(100dvh - ${top + 8}px)`, "important");
    panel.style.setProperty("overflow", "auto", "important");
    panel.dataset.dinpulsMenuRepaired = "true";
    return true;
  }
  function audit() {
    for (const [element, original] of originals) {
      if (!element.isConnected) { originals.delete(element); continue; }
      if (original.value) element.style.setProperty("color", original.value, original.priority);
      else element.style.removeProperty("color");
      delete element.dataset.dinpulsContrastRepaired;
    }
    originals.clear();
    const result = { repaired: [], skipped: 0, menuRepaired: repairMenu() };
    for (const element of document.querySelectorAll("h1,h2,h3,h4,p,label,small,strong,a,button,span")) {
      if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
      if (element.closest("[hidden],[inert],svg")) continue;
      const r = element.getBoundingClientRect(), style = root.getComputedStyle(element);
      if (!r.width || !r.height || style.visibility !== "visible") continue;
      const bg = background(element), fg = rgb(style.color);
      if (!bg || !fg) { result.skipped++; continue; }
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      const minimum = large ? 3 : 4.5;
      const foregroundParts = style.color.match(/[\d.]+/g);
      const alpha = foregroundParts?.length > 3 ? Number(foregroundParts[3]) : 1;
      const before = contrast(blend(fg, bg, alpha), bg);
      if (before >= minimum) continue;
      const black = [0, 0, 0], white = [255, 255, 255];
      const replacement = contrast(black, bg) > contrast(white, bg) ? "#000000" : "#ffffff";
      originals.set(element, { value: element.style.getPropertyValue("color"), priority: element.style.getPropertyPriority("color") });
      element.style.setProperty("color", replacement, "important");
      element.dataset.dinpulsContrastRepaired = "true";
      result.repaired.push({ text: element.textContent.trim().slice(0, 100), before: Math.round(before * 100) / 100, color: replacement });
    }
    last = result;
    return result;
  }
  function schedule() {
    root.clearTimeout(timer);
    timer = root.setTimeout(audit, 100);
  }
  api.audit = audit;
  api.lastResult = () => last;
  root.DinPulsUIResilience = api;
  function start() {
    audit();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["class", "data-theme", "data-season", "hidden"]
    });
    root.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    document.addEventListener("click", schedule, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window === "undefined" ? globalThis : window);
