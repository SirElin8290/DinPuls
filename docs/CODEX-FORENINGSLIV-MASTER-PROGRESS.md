# Föreningsliv masterdokument progress

Senast uppdaterad: 2026-09-25

## Underlag

Masterfil: `Föreningar Masterdokument - dubblettrensat.docx`

Masterfilen innehåller 4 196 tabellposter för 21 kommuner. Tabellen är en kandidatlista. Poster ska kontrolleras mot aktuell offentlig källa innan de publiceras eller exkluderas.

## Aktuell fortsättningspunkt

Arvika är pågående kommun.

- Sammanhängande behandlat intervall: post 1–185 i Arvika-tabellen.
- Nästa post: 186, `Klässbols Båtklubb`.
- Dessutom verifierade i förväg i samma arbetsomgång: 188 `Klässbols SK`, 190 `Knöppelåsens Ryttarsällskap`, 192 `Korpen Arvika-Eda`, 193 `Kronans Fotbollsklubb`, 195 `Kulturföreningen Kolonin`, 199 `Lions Club Arvika` och 200 `LP-Kontakten`.
- Säkra dubbletter sammanslagna: post 180 `Jössefors Idrottsklubb` med post 181 `Jössefors IK`; post 189 `Klässbols Sportklubb` med post 188 `Klässbols SK`.
- Inga poster har raderats eller slagits ihop enbart på namnlikhet.

## Masterposter per kommun

| Kommun | Masterposter |
|---|---:|
| Arvika | 370 |
| Bengtsfors | 109 |
| Dals-Ed | 81 |
| Eda | 172 |
| Filipstad | 170 |
| Forshaga | 161 |
| Färgelanda | 154 |
| Grums | 177 |
| Hagfors | 177 |
| Hammarö | 151 |
| Karlstad | 358 |
| Kil | 175 |
| Kristinehamn | 178 |
| Mellerud | 251 |
| Munkfors | 115 |
| Storfors | 133 |
| Sunne | 195 |
| Säffle | 223 |
| Torsby | 312 |
| Åmål | 236 |
| Årjäng | 298 |
| **Totalt** | **4 196** |

## Publicerad datamängd efter denna arbetsomgång

Den kombinerade Föreningsliv-motorn innehåller lokalt 1 579 unika sidor. Arvika innehåller 303 unika sidor efter de två säkra dubblettsammanslagningarna.

Fokuserade tester som ska köras efter varje batch:

```text
node scripts/test_association_hub.js
node scripts/test_association_regression.js
node --check foreningsliv.js
git diff --check
```

Det äldre `scripts/test_sport_portal.js` har ett redan känt, orelaterat fel för `Kristinehamn / Boxningsklubben Trim` eftersom den befintliga posten saknar extern URL. Det felet ska inte döljas genom sänkta valideringar.
