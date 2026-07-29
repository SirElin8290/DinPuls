/* DinPuls Sport – Sprint 4.4 matchdetaljer */
(() => {
  const baseRenderMatchCard44=renderMatchCard;
  renderMatchCard=function(match,type){
    const html=baseRenderMatchCard44(match,type);
    const id=encodeURIComponent(matchIdentity(match));
    const municipality=encodeURIComponent(sportMunicipality);
    const detail=`<a class="sport-match-detail-link" href="match.html?kommun=${municipality}&id=${id}"><i data-lucide="panel-top-open"></i>Matchdetaljer</a>`;
    return html.replace('<div class="sport-match-actions">',`<div class="sport-match-actions">${detail}`);
  };
  renderSportPage();
})();