(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let currentStep = 1;

  const TERMS = [
    ["1. Avtalets omfattning", "DinPuls visar företagets annonsmaterial på de annonsplatser, i den kommun och under den avtalsperiod som anges i avtalet. Endast de annonsplatser som uttryckligen anges i avtalet omfattas."],
    ["2. Annonsmaterial och ansvar", "Företaget ansvarar för att bilder, texter, länkar, varumärken och övrigt material som lämnas till DinPuls är korrekta och att företaget har rätt att använda materialet. DinPuls får stoppa material som är olagligt, vilseledande, kränkande eller tekniskt skadligt."],
    ["3. Bannerbyten och schemaläggning", "Företaget kan planera upp till fyra kommande banners per avtalad annonsplats. Fyra bannerbyten ingår under avtalsperioden om inget annat uttryckligen anges i avtalet."],
    ["4. Pris och betalning", "Pris, debiteringsform och avtalsvärde framgår av det individuella avtalet. Samtliga angivna priser är exklusive moms. En kostnadsfri annonsplats ska uttryckligen anges som kostnadsfri i avtalet."],
    ["5. Statistik och resultat", "Statistik i företagsportalen är en teknisk mätning av bland annat visningar och klick. DinPuls garanterar inte ett visst antal visningar, klick, förfrågningar eller affärer."],
    ["6. Avtalstid och förnyelse", "Avtalet gäller under den period som anges i avtalet. Avtalet förnyas inte automatiskt. Om årlig förnyelseprövning har valts ska parterna ta ställning till en ny avtalsperiod innan det befintliga avtalet löper ut."],
    ["7. Ändringar efter signering", "Efter att båda parter har signerat ska den signerade avtalsversionen vara låst. Ändringar av pris, period, annonsplatser eller andra väsentliga villkor kräver en ny avtalsversion eller ett skriftligt tillägg som godkänns av båda parter."],
    ["8. Elektronisk underskrift och avtalskopia", "Avtalet ska undertecknas av behörig företrädare för företaget och DinPuls. Efter slutförd signering ska båda parter få tillgång till samma signerade avtalskopia. Den signerade versionen ska arkiveras tillsammans med avtalsnummer, avtalsversion och signeringstidpunkt."],
    ["9. Kontakt och personuppgifter", "Kontaktuppgifter som lämnas i samband med avtalet används för administration av avtalsförhållandet, företagsportalen, avtalskopior och nödvändig kommunikation mellan parterna."],
    ["10. Avtalshandlingen", "Det individuella avtalet, dessa standardvillkor och eventuella uttryckliga avtalsnoteringar utgör tillsammans parternas avtal. Vid motstridiga uppgifter gäller en uttrycklig individuell avtalsnotering framför standardvillkoren."],
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
  }

  function buildTerms() {
    return TERMS.map(([title, text]) => `<article class="wizard-term"><h4>${title}</h4><p>${text}</p></article>`).join("");
  }

  function ensureWizard() {
    const form = $("#contractForm");
    if (!form || form.dataset.wizardReady === "1") return;
    form.dataset.wizardReady = "1";

    const heading = form.querySelector(".panel-heading");
    const firstGrid = form.querySelector(".grid2");
    const placementsTitle = [...form.children].find(node => node.tagName === "H3" && node.textContent.includes("Annonsplatser"));
    const placements = $("#placements");
    const addPlacement = $("#addPlacement");
    const totals = form.querySelector(".grid2.totals");
    const submitActions = [...form.children].find(node => node.classList?.contains("actions"));
    const footnote = [...form.children].find(node => node.classList?.contains("muted") && node.classList?.contains("small"));
    if (!heading || !firstGrid || !placementsTitle || !placements || !addPlacement || !totals || !submitActions) return;

    const signatureSelect = form.querySelector('[name="signatureRequired"]');
    if (signatureSelect) {
      signatureSelect.value = "true";
      const label = signatureSelect.closest("label");
      if (label) label.hidden = true;
    }

    const stepper = document.createElement("ol");
    stepper.className = "contract-stepper";
    stepper.innerHTML = ["Avtalet", "Uppgifter", "Förhandsgranska", "Signering"].map((label, index) => `<li data-step-marker="${index + 1}"><span>${index + 1}</span><b>${label}</b></li>`).join("");
    heading.insertAdjacentElement("afterend", stepper);

    const step1 = document.createElement("section");
    step1.className = "wizard-step";
    step1.dataset.wizardStep = "1";
    step1.innerHTML = `<div class="wizard-intro"><span class="eyebrow">STEG 1 AV 4</span><h3>Gå igenom avtalet med kunden</h3><p>Det här är DinPuls standardvillkor för annonsavtal v3.0. Gå igenom dem tillsammans innan ni fyller i företagets individuella avtalsuppgifter.</p></div><div class="wizard-contract"><header><strong>DinPuls.se</strong><span>ANNONSAVTAL · STANDARDVILLKOR v3.0</span></header>${buildTerms()}</div><label class="wizard-confirm"><input id="termsReviewed" type="checkbox"> <span>Jag och kunden har gått igenom standardvillkoren ovan.</span></label><div class="wizard-nav"><button type="button" class="primary" data-wizard-next="2" disabled>Fortsätt till uppgifter →</button></div>`;

    const step2 = document.createElement("section");
    step2.className = "wizard-step";
    step2.dataset.wizardStep = "2";
    step2.innerHTML = `<div class="wizard-intro"><span class="eyebrow">STEG 2 AV 4</span><h3>Fyll i avtalsuppgifterna</h3><p>Nu fyller ni tillsammans i vem avtalet gäller, vilka annonsplatser som ingår, period och pris.</p></div>`;
    for (const node of [firstGrid, placementsTitle, placements, addPlacement, totals]) step2.append(node);
    const nav2 = document.createElement("div");
    nav2.className = "wizard-nav";
    nav2.innerHTML = `<button type="button" class="secondary" data-wizard-prev="1">← Till avtalet</button><button type="button" class="primary" data-wizard-next="3">Förhandsgranska →</button>`;
    step2.append(nav2);

    const step3 = document.createElement("section");
    step3.className = "wizard-step";
    step3.dataset.wizardStep = "3";
    step3.innerHTML = `<div class="wizard-intro"><span class="eyebrow">STEG 3 AV 4</span><h3>Kontrollera exakt vad som ska signeras</h3><p>Läs igenom uppgifterna med kunden. Om något är fel går ni tillbaka och rättar innan signeringen.</p></div><div id="contractPreview" class="wizard-preview"></div><div class="wizard-nav"><button type="button" class="secondary" data-wizard-prev="2">← Ändra uppgifter</button><button type="button" class="primary" data-wizard-next="4">Allt stämmer – till signering →</button></div>`;

    const step4 = document.createElement("section");
    step4.className = "wizard-step";
    step4.dataset.wizardStep = "4";
    step4.innerHTML = `<div class="wizard-intro"><span class="eyebrow">STEG 4 AV 4</span><h3>Klar för signering</h3><p>Avtalet kommer att kräva underskrift av både kunden och DinPuls. Finger-/pennsignatur, låst PDF, R2-arkiv och automatisk avtalskopia via e-post kopplas till detta steg i nästa backendimplementation.</p></div><div class="signature-prep"><div><span>1</span><p><b>Kundens underskrift</b><small>Namn, befattning och signatur med finger eller penna.</small></p></div><div><span>2</span><p><b>DinPuls underskrift</b><small>DinPuls undertecknar samma låsta avtalsversion.</small></p></div><div><span>3</span><p><b>Signerad avtalskopia</b><small>PDF arkiveras och skickas till företaget i separat välkomstmejl.</small></p></div></div><p class="wizard-warning"><b>Nuvarande säkra mellanläge:</b> knappen nedan skapar endast ett avtalsutkast med obligatoriskt signaturkrav. Det aktiverar inte avtalet utan underskrift.</p><div class="wizard-nav"><button type="button" class="secondary" data-wizard-prev="3">← Till förhandsgranskning</button></div>`;
    submitActions.querySelector('button[type="submit"]').textContent = "Skapa avtalsutkast för signering";
    step4.querySelector(".wizard-nav").append(submitActions);
    if (footnote) step4.append(footnote);

    form.append(step1, step2, step3, step4);

    $("#termsReviewed").addEventListener("change", event => {
      const button = form.querySelector('[data-wizard-next="2"]');
      button.disabled = !event.target.checked;
    });
    form.addEventListener("click", event => {
      const next = event.target.closest("[data-wizard-next]");
      const prev = event.target.closest("[data-wizard-prev]");
      if (next) {
        const target = Number(next.dataset.wizardNext);
        if (target === 3 && !validateDetails(form)) return;
        if (target === 3 || target === 4) renderPreview(form);
        showStep(target);
      }
      if (prev) showStep(Number(prev.dataset.wizardPrev));
    });

    showStep(1);
  }

  function validateDetails(form) {
    const step = form.querySelector('[data-wizard-step="2"]');
    const required = [...step.querySelectorAll("input[required],select[required]")];
    for (const field of required) {
      if (!field.checkValidity()) { field.reportValidity(); field.focus(); return false; }
    }
    const rows = $$(".placement");
    const ids = rows.map(row => row.querySelector(".slot")?.value).filter(Boolean);
    if (!ids.length || new Set(ids).size !== ids.length) { alert("Välj minst en unik annonsplats."); return false; }
    return true;
  }

  function renderPreview(form) {
    const data = new FormData(form);
    const rows = $$(".placement");
    const placements = rows.map(row => ({ id: row.querySelector(".slot")?.value || "", location: row.querySelector(".slot-location")?.value || "" }));
    const billingType = data.get("billingType") || "paid";
    const price = billingType === "complimentary" ? 0 : Number(data.get("price") || 0);
    const annualPrice = Number(data.get("annualPrice") || 0);
    const count = placements.length;
    const renewal = data.get("renewalType") === "none" ? "Ingen automatisk förnyelse eller uppföljning" : "Årlig förnyelseprövning – ingen automatisk förnyelse";
    const preview = $("#contractPreview");
    if (!preview) return;
    preview.innerHTML = `<header><div><span class="eyebrow">ANNONSAVTAL v3.0</span><h3>${escapeHtml(data.get("company"))}</h3><p>${escapeHtml(data.get("orgNo"))}</p></div><strong>Signatur krävs</strong></header><div class="preview-grid"><div><small>Kontaktperson</small><b>${escapeHtml(data.get("contact"))}</b><span>${escapeHtml(data.get("email"))}<br>${escapeHtml(data.get("phone"))}</span></div><div><small>Kommun</small><b>${escapeHtml(data.get("municipality"))}</b></div><div><small>Avtalsperiod</small><b>${escapeHtml(data.get("startDate"))} – ${escapeHtml(data.get("endDate"))}</b></div><div><small>Debitering</small><b>${billingType === "complimentary" ? "Kostnadsfri plats" : "Ordinarie betalande"}</b></div><div><small>Månadspris</small><b>${formatMoney(price * count)} exkl. moms</b></div><div><small>Avtalsvärde 12 mån</small><b>${formatMoney((billingType === "complimentary" ? 0 : annualPrice * count))} exkl. moms</b></div></div><h4>Annonsplatser</h4><ul>${placements.map(item => `<li><b>${escapeHtml(item.id)}</b><span>${escapeHtml(item.location)}</span></li>`).join("")}</ul><h4>Förnyelse</h4><p>${escapeHtml(renewal)}</p>${data.get("valueNote") ? `<h4>Särskild avtalsnotering</h4><p>${escapeHtml(data.get("valueNote"))}</p>` : ""}<div class="preview-terms"><h4>Standardvillkor</h4><p>Parterna bekräftar att DinPuls standardvillkor för annonsavtal v3.0 har gåtts igenom. Den individuella avtalsdelen ovan och standardvillkoren ska tillsammans utgöra den version som låses vid signering.</p></div>`;
  }

  function showStep(step) {
    currentStep = Math.min(4, Math.max(1, Number(step) || 1));
    $$('[data-wizard-step]').forEach(section => { section.hidden = Number(section.dataset.wizardStep) !== currentStep; });
    $$('[data-step-marker]').forEach(marker => {
      const number = Number(marker.dataset.stepMarker);
      marker.classList.toggle("active", number === currentStep);
      marker.classList.toggle("done", number < currentStep);
    });
    $("#contractForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetWizardWhenOpened() {
    const observer = new MutationObserver(() => {
      const form = $("#contractForm");
      if (!form || form.hidden) return;
      const reviewed = $("#termsReviewed");
      if (reviewed) reviewed.checked = false;
      const next = form.querySelector('[data-wizard-next="2"]');
      if (next) next.disabled = true;
      const signature = form.querySelector('[name="signatureRequired"]');
      if (signature) signature.value = "true";
      showStep(1);
    });
    const form = $("#contractForm");
    if (form) observer.observe(form, { attributes: true, attributeFilter: ["hidden"] });
  }

  function init() {
    ensureWizard();
    resetWizardWhenOpened();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
