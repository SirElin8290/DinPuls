# DinPuls Energi v1

Startsidan läser `data/energy.json`, aldrig tredjeparts-API:t direkt. `scripts/update_energy.py` hämtar dagens priser för SE1–SE4 och validerar numeriska värden, ISO-tider, sammanhängande perioder och leveransdag innan cachefilen ersätts. Om dagens hämtning misslyckas avslutas körningen utan att skriva över senast fungerande fil. Frontend visar filen endast när en period täcker aktuell tid i `Europe/Stockholm`; annars visas ett tydligt otillgängligt-läge.

- Källa/API: https://www.elprisetjustnu.se/elpris-api
- Endpoint: `https://www.elprisetjustnu.se/api/v1/prices/YYYY/MM-DD_SE1.json` (SE1–SE4)
- Modell: `SEK_per_kWh`, `time_start`, `time_end`; konverteras till öre/kWh genom multiplikation med 100.
- Prisets innebörd: dagen-före-marknadens spotpris utan moms, skatter, elhandlarpåslag och nätavgift.
- Upplösning: 15 minuter för leveransdagar från 1 oktober 2025 (96 perioder under normaldygn; DST-dygn valideras separat).
- Publicering: dagens priser och, när de finns, morgondagens priser. Morgondagens data kommer normalt tidigast kl. 13.
- Villkor: API:t beskrivs som öppet och gratis för valfri användning; publik källhänvisning önskas och visas i modulen.
- Ursprung: tjänsten anger ENTSO-E Transparency Platform och en EUR/SEK-växelkurs som grund.

Kommunernas verifierade elområden ligger centralt i `data/electricity-areas.json`. Svenska kraftnät är kartkälla. Alla 21 nuvarande DinPuls-kommuner ligger i SE3.
