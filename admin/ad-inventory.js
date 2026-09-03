// Central och enda tillåtna katalog för säljbara annonsplatser i DinPuls.
// Avtalssystemet får endast använda ID:n som finns här.
(function () {
  "use strict";

  const homepageSlots = [
    ...Array.from({ length: 10 }, (_, index) => ({ id: `P1-${String(index + 1).padStart(2, "0")}`, group: "premium-ad-1", label: `Företag nära dig · plats ${index + 1}`, location: "Efter Dagens viktigaste / före huvudmodulerna" })),
    ...Array.from({ length: 10 }, (_, index) => ({ id: `P2-${String(index + 11).padStart(2, "0")}`, group: "premium-ad-2", label: `Aktuellt från företag · plats ${index + 11}`, location: "Mellan innehållsblocken på startsidan" })),
    ...Array.from({ length: 10 }, (_, index) => ({ id: `P3-${String(index + 21).padStart(2, "0")}`, group: "premium-ad-3", label: `Mer från företag nära dig · plats ${index + 21}`, location: "Nedre annonsblocket på startsidan" }))
  ].map(slot => ({ ...slot, module: "Startsida", page: "index.html", position: Number(slot.id.slice(-2)) }));

  const subpages = [
    { key: "BIO", module: "Bio", page: "bio.html", count: 4, locations: ["Efter introduktionen", "Efter kommun- och sökfiltret", "Efter biograflistan", "Längst ned efter resultatet"] },
    { key: "BOST", module: "Bostäder", page: "bostader.html", count: 7, locations: ["Efter sidhuvudet", "Efter bostadsfiltren", "I bostadsflödet", "Efter bostadsresultatet", "Nedre annonsplats 1", "Nedre annonsplats 2", "Nedre annonsplats 3"] },
    { key: "DRIV", module: "Drivmedel", page: "drivmedel.html", count: 4, locations: ["Efter introduktionen", "Efter stationsfiltren", "I stationsflödet", "Efter stationsresultatet"] },
    { key: "EVEN", module: "Evenemang", page: "evenemang.html", count: 4, locations: ["Efter introduktionen", "Efter evenemangsfiltren", "I evenemangsflödet", "Efter lokala kalendrar och källor"] },
    { key: "JOBB", module: "Jobb", page: "jobb.html", count: 4, locations: ["Efter sidhuvudet", "Efter jobbfiltren", "I jobbflödet", "Efter jobbresultatet"] },
    { key: "LUNCH", module: "Lunch", page: "lunch.html", count: 4, locations: ["Efter introduktionen", "Efter lunchfiltren", "I lunchflödet", "Efter lunchresultatet"] },
    { key: "MAT", module: "Matkasse", page: "matkasse.html", count: 4, locations: ["Efter introduktionen", "Efter baskassans sammanfattning", "Mellan inköpslista och prisjämförelse", "Efter prisjämförelsen"] },
    { key: "MYND", module: "Myndigheter", page: "myndigheter.html", count: 4, locations: ["Efter akuta kontaktvägar", "Efter myndighetsfiltren", "Efter myndighetsresultatet", "Efter källor och aktualitet"] },
    { key: "NYH", module: "Nyheter", page: "nyheter.html", count: 4, locations: ["Efter sidhuvudet", "Efter nyhetsfiltren", "I nyhetsflödet", "Efter svenska och internationella källor"] },
    { key: "SERV", module: "Service & hantverk", page: "service.html", count: 4, locations: ["Efter introduktionen", "Efter servicefiltren", "Efter företagskatalogen", "Efter informationen för lokala företag"] },
    { key: "TRAF", module: "Trafik", page: "trafik.html", count: 4, locations: ["Efter introduktionen", "Efter trafikfiltren", "I trafikflödet", "Efter officiella trafikkällor"] },
    { key: "VARD", module: "Vård & hälsa", page: "vard.html", count: 4, locations: ["Efter akuta vårdkontakter", "Efter vårdfiltren", "Mellan offentlig vård och lokala mottagningar", "Efter lokala mottagningar"] },
    { key: "SPORT", module: "Idrott & motion", page: "sport.html", count: 4, locations: ["Efter sportöversikten", "Efter första tredjedelen av sporterna", "Efter andra tredjedelen av sporterna", "Efter sportflödet"] },
    { key: "FRIT", module: "Fritid & föreningsliv", page: "fritid.html", count: 4, locations: ["Efter sök- och kommunfiltret", "Efter första delen av fritidskategorierna", "Efter andra delen av fritidskategorierna", "Efter fritidsflödet"] }
  ];

  const subpageSlots = subpages.flatMap(page => Array.from({ length: page.count }, (_, index) => {
    const position = index + 1;
    return {
      id: `${page.key}-${String(position).padStart(2, "0")}`,
      group: `subpage-${page.key.toLowerCase()}`,
      module: page.module,
      page: page.page,
      position,
      label: `${page.module} · plats ${position}`,
      location: page.locations[index]
    };
  }));

  window.DINPULS_AD_INVENTORY = Object.freeze([...homepageSlots, ...subpageSlots].map(slot => Object.freeze(slot)));
})();
