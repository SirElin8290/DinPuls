# Full STRICT-analys – 21 kommuner

Datum: 2026-09-08

Styrande regel: `DINPULS-AUDIT-RULES.md`. Tidigare godkännanden räknas inte. En kommun är 100 % grön endast när samtliga obligatoriska moduler samtidigt passerar miniminivåerna och aktiv/live-data är verifierad.

## Sammanfattning

Senaste fulla STRICT-körningen genererades 2026-09-08 13:00:07 och använde 39 livefiler, 0 repo-fallback. Den gav 18/21 kommuner 100 % grönt. Efter auditkörningen har Karlstad fått två ytterligare fritidsposter och en ytterligare förening i aktiva datafiler, vilket på repodatans nivå löser exakt de två tidigare blockerarna (8→10 fritid och 19→20 föreningar). Karlstad får ändå inte formellt klassas som 100 % grön förrän den nya datan har verifierats i aktiv/live-kedjan enligt regeln.

## Kommun för kommun

| Kommun | STRICT-status | Jobb | Bostäder | Event | Nyheter | Vård | Service | Lunch | Fritid | Föreningar | Åtgärd |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Åmål | 🟢 100 % | 25 | 51 | 15 | 42/42 | 19/8 kat | 17/5 kat | 4 | 43 | 40 | Ingen |
| Årjäng | 🟢 100 % | 26 | 10 | 29 | 35/35 | 8/5 kat | 11/4 kat | 7 | 119 | 61 | Ingen |
| Bengtsfors | 🟢 100 % | 22 | 34 | 8 | 43/43 | 16/10 kat | 15/9 kat | 7 | 53 | 34 | Ingen |
| Mellerud | 🟢 100 % | 26 | 18 | 10 | 34/34 | 7/4 kat | 15/4 kat | 5 | 96 | 27 | Ingen |
| Arvika | 🟢 100 % | 49 | 8 | 25 | 72/72 | 30/8 kat | 21/11 kat | 8 | 202 | 103 | Ingen |
| Grums | 🟢 100 % | 14 | 9 | 7 | 30/30 | 12/6 kat | 9/6 kat | 10 | 50 | 30 | Ingen |
| Säffle | 🟢 100 % | 29 | 55 | 5 | 71/71 | 18/7 kat | 16/4 kat | 10 | 64 | 44 | Ingen |
| Dals-Ed | 🟢 100 % | 6 | 24 | 28 | 21/21 | 9/7 kat | 12/10 kat | 6 | 24 | 25 | Ingen |
| Eda | 🟢 100 % | 26 | 41 | 9 | 45/45 | 13/7 kat | 13/8 kat | 5 | 43 | 29 | Ingen |
| Filipstad | 🟢 100 % | 9 | 10 | 10 | 68/68 | 8/5 kat | 14/8 kat | 5 | 14 | 34 | Ingen |
| Forshaga | 🟢 100 % | 12 | 10 | 43 | 41/41 | 11/6 kat | 10/10 kat | 8 | 34 | 20 | Ingen |
| Färgelanda | 🟢 100 % | 7 | 4 | 6 | 26/27 | 9/8 kat | 8/5 kat | 4 | 12 | 24 | Ingen |
| Hagfors | 🟢 100 % | 22 | 23 | 22 | 45/45 | 13/7 kat | 12/7 kat | 8 | 24 | 23 | Ingen |
| Hammarö | 🟢 100 % | 9 | 1 | 38 | 41/42 | 10/7 kat | 8/5 kat | 5 | 18 | 21 | Ingen |
| Karlstad | 🟡 inväntar live-omkontroll | 94 | 1 | 31 | 87/87 | 36/10 kat | 8/6 kat | 4 | 10 efter senare commit | 20 efter senare commit | Kör ny STRICT live-audit; godkänn först om aktiva/live-data ger 10/20 och övriga moduler fortsatt gröna |
| Kil | 🟢 100 % | 11 | 4 | 5 | 35/36 | 10/4 kat | 18/5 kat | 5 | 21 | 20 | Ingen |
| Kristinehamn | 🟢 100 % | 55 | 1 | 30 | 58/60 | 6/4 kat | 9/6 kat | 4 | 10 | 23 | Ingen |
| Munkfors | 🟢 100 % | 9 | 1 | 19 | 25/25 | 6/5 kat | 8/5 kat | 4 | 12 | 22 | Ingen |
| Storfors | 🟡 EJ 100 % | 4 | 3 | 0 | 60/60 | 5/5 kat | 8/6 kat | 2/2 verifierat faktiskt lunchutbud | 13 | 34 | Blockerare: 0 aktuella/framtida evenemang. Minst 5 krävs. Ingen utfyllnad med gamla/irrelevanta poster. |
| Sunne | 🟢 100 % | 20 | 8 | 7 | 61/61 | 16/6 kat | 16/5 kat | 4 | 13 | 24 | Ingen |
| Torsby | 🟡 EJ 100 % | 22 | 0 | 31 | 44/44 | 2/0 kat | 3/3 kat | 1 | 2 | 5 | Åtta blockerare, se nedan |

## Torsby – verifierade blockerare och åtgärdsordning

1. **Bostäder:** 0 faktiska aktuella objekt. Torsby Bostäder har aktiv sökfunktion, men STRICT kräver minst ett faktiskt aktuellt ledigt objekt – en generell söklänk räcker inte.
2. **Vård & hälsa:** 2 verksamheter / 0 kategorier. Kräver minst 5 relevanta verksamheter med rimlig kategori-bredd.
3. **Service & hantverk:** 3 företag / 3 kategorier. Kräver minst 8 företag i minst 4 kategorier.
4. **Myndigheter:** centrala direktlänkar saknas för socialtjänst, ekonomiskt bistånd, budget- och skuldrådgivning, äldreomsorg, LSS och bygglov.
5. **Dagens lunch:** 1 verifierat lunchställe. Kräver normalt minst 4, alternativt strikt verifierad verklighetsundantagsprövning enligt regeln.
6. **Bio:** datan är felaktigt tom. Biograf Stjärnan i Torsby är verifierad aktiv med aktuellt program i september 2026. Detta är en konkret databristsfix och ska läggas in i aktiv bio-pipeline.
7. **Fritid & aktiviteter:** 2 poster. Kräver minst 10 verkliga lokala aktiviteter/anläggningar med bredd.
8. **Idrott & föreningar:** 5 poster. Kräver normalt minst 20 verkliga lokala föreningar eller verifierat lägre faktiskt utbud.

## Storfors – regelstyrd bedömning

Storfors har 0 aktuella/framtida evenemang i aktiv data. Sökning i nu tillgängliga officiella/primära källor ger inte underlag för att legitimt fylla till fem framtida publika evenemang. Därför ska kommunen förbli gul i eventmodulen tills verkliga aktuella evenemang finns eller en fungerande aktiv källa levererar dem. Träningar, gamla evenemang och irrelevanta poster får inte användas som utfyllnad.

## Nästa verifiering

Efter varje dataåtgärd ska kedjan verifieras i denna ordning: repo/source → aktiv kodväg → workflow/runtime-output → live-sida. Ingen kommun flyttas till 100 % grönt enbart på grund av en commit.
