(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;

  // Death Mode ska inte kunna lösas genom svarslängd eller språklig form.
  // Rätt svar och facitindex lämnas helt orörda. Endast felalternativen får
  // en kort, plausibel regelmotivering som gör alternativen mer likvärdiga.
  const rationales = [
    " eftersom den första identifierade regelhändelsen styr när spelet ska stoppas och hur återstarten ska hanteras",
    " eftersom den senare delen av händelseförloppet inte ändrar den regeltekniska bedömning som redan har uppstått",
    " eftersom domaren i den här sekvensen ska skilja mellan själva grundförseelsen och den efterföljande spelmässiga konsekvensen"
  ];

  const shortRationales = [
    "; den avgörande tidpunkten är den första regelhändelsen i sekvensen",
    "; den efterföljande beröringen förändrar inte den tidigare bedömningen",
    "; grundförseelsen ska bedömas separat från det som händer därefter"
  ];

  for (const q of bank) {
    if (q.level !== "death" || !Array.isArray(q.a) || q.a.length !== 4) continue;
    const correct = q.x;
    const correctLength = String(q.a[correct] || "").length;

    q.a = q.a.map((answer, index) => {
      if (index === correct) return answer; // Facit/rätt svar ändras aldrig här.
      let text = String(answer || "").trim();
      if (!text) return text;

      // Undvik att lägga på samma formulering två gånger vid eventuell dubbel laddning.
      if (text.includes("regeltekni") || text.includes("avgörande tidpunkten") || text.includes("grundförseelsen ska bedömas separat")) return text;

      // Kortare distraktorer får den längre motiveringen. Redan långa alternativ
      // får en kortare precisering så att inget alternativ sticker ut enbart på längd.
      const target = Math.max(72, correctLength - 8);
      if (text.length < target) text += rationales[index % rationales.length];
      else if (text.length < 105) text += shortRationales[index % shortRationales.length];
      return text;
    });
  }
})();
