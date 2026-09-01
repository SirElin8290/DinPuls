(async function renderMunicipalityCoverage() {
  const target = document.querySelector("#municipality-coverage");
  if (!target) return;

  try {
    const response = await fetch("data/municipalities.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const registry = await response.json();
    const municipalities = Array.isArray(registry.municipalities) ? registry.municipalities : [];
    const production = municipalities.filter(item => item.launchMode !== "pilot").map(item => item.name);
    const pilots = municipalities.filter(item => item.launchMode === "pilot").map(item => item.name);
    if (!municipalities.length || production.some(name => !name) || pilots.some(name => !name)) {
      throw new Error("Kommunregistret saknar giltiga poster");
    }

    const productionText = production.length ? production.join(", ") : "inga kommuner ännu";
    const pilotText = pilots.length ? pilots.join(", ") : "inga";
    target.textContent = `DinPuls omfattar ${municipalities.length} kommuner. Fullt lanserade: ${productionText}. Pilotkommuner: ${pilotText}. Plattformen är byggd för att kunna skalas vidare utan att pilotkommuner framställs som färdiga.`;
  } catch (error) {
    console.warn("Kunde inte läsa aktuell kommunstatus", error);
  }
})();
