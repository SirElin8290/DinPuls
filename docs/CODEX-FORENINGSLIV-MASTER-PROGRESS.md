# Föreningsliv masterdokument progress

Senast uppdaterad: 2026-09-25

## Underlag

Masterfil: `Föreningar Masterdokument - dubblettrensat.docx`

Masterfilen innehåller 4 196 tabellposter för 21 kommuner. Tabellen är en kandidatlista. Poster ska kontrolleras mot aktuell offentlig källa innan de publiceras eller exkluderas.

## Status

Massimporten är genomförd för samtliga 4 196 masterposter och alla 21 kommuner.

- 1 418 poster fanns redan och deras rikare data har bevarats.
- 2 770 saknade poster har importerats.
- 8 poster har exkluderats med konkret utfall och orsak.
- 0 masterposter är obehandlade.
- Radvisa utfall finns i `data/association-master-outcomes.json`.
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

## Publicerad datamängd efter senaste arbetsomgång

Den kombinerade Föreningsliv-motorn innehåller lokalt 4 781 unika sidor. Arvika innehåller 372 unika sidor efter de säkra dubblettsammanslagningarna och massimporten.

Den befintliga IBGO-importen har utökats med de officiella registren för Hammarö, Kristinehamn, Sunne och Torsby. Det ökade den verifierade lokala datamängden med 432 unika sidor. Den manuellt berikade datan har samtidigt flyttats till de varaktiga curated-filer som importworkflowet bygger från, så att den inte skrivs över vid nästa körning.

Frontend filtrerar nu bort poster markerade som `inactive`, `duplicate` eller `not_association`. Endast poster utan exkluderande status eller med aktiv verifieringsstatus publiceras.

Fokuserade tester som ska köras efter varje batch:

```text
node scripts/test_association_hub.js
node scripts/test_association_regression.js
node --check foreningsliv.js
git diff --check
```

Det äldre `scripts/test_sport_portal.js` har ett redan känt, orelaterat fel för `Kristinehamn / Boxningsklubben Trim` eftersom den befintliga posten saknar extern URL. Det felet ska inte döljas genom sänkta valideringar.
