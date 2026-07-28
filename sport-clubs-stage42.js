(() => {
  const baseRenderClubDirectory42 = renderClubDirectory;
  renderClubDirectory = function renderClubDirectory42(clubs, compact = false) {
    const html = baseRenderClubDirectory42(clubs, compact);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    wrapper.querySelectorAll(".sport-club-card").forEach((card, index) => {
      const club = clubs[index];
      if (!club) return;
      const external = card.querySelector(".sport-club-open");
      if (external) {
        external.title = "Öppna officiell sida";
        external.setAttribute("aria-label", `Öppna ${club.name}s officiella sida`);
      }
      const internal = document.createElement("a");
      internal.className = "sport-club-profile";
      internal.href = `club.html?kommun=${encodeURIComponent(sportMunicipality)}&klubb=${encodeURIComponent(club.name)}`;
      internal.innerHTML = `<span>Föreningssida</span><i data-lucide="chevron-right"></i>`;
      internal.setAttribute("aria-label", `Öppna DinPuls föreningssida för ${club.name}`);
      card.appendChild(internal);
    });
    return wrapper.innerHTML;
  };

  const style = document.createElement("style");
  style.textContent = `.sport-club-card{grid-template-columns:auto minmax(0,1fr) auto auto}.sport-club-profile{grid-column:2/-1;display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:9px;border-top:1px solid var(--sport-line);color:var(--sport-blue);font-size:9px;font-weight:800}.sport-club-profile svg{width:14px}@media(max-width:620px){.sport-club-card{grid-template-columns:auto minmax(0,1fr) auto}.sport-club-open{display:none}.sport-club-profile{grid-column:1/-1}}`;
  document.head.appendChild(style);
  if (sportData) renderSportPage();
})();
