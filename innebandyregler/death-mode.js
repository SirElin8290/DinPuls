(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;

  /*
   * DEATH MODE QUALITY GATE
   * -----------------------
   * Death Mode questions must not be published until every scenario has:
   * 1. one unambiguous correct ruling,
   * 2. that ruling present among the answer alternatives,
   * 3. x pointing to that exact alternative,
   * 4. an exact, traceable reference to the 2026 rulebook,
   * 5. an explanation that follows the cited rule(s),
   * 6. enough facts in the scenario to reach the ruling without guessing.
   *
   * The first experimental Death Mode bank (9001–9010) is deliberately
   * withdrawn because it was created before this rule-by-rule verification.
   * It must not be used for referee training.
   */
  const death = [];

  const existing = new Set(bank.map(q => q.id));
  death.forEach(q => { if (!existing.has(q.id)) bank.push(q); });
})();
