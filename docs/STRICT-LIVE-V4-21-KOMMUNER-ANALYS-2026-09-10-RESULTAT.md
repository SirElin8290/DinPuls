# STRICT LIVE v4 – full analys av 21 kommuner

Datum: 2026-09-10  
Kalibreringskommun: Åmål  
Bindande regel: `DINPULS-AUDIT-RULES.md` – STRICT LIVE v4

## Sammanfattning

Efter omklassning enligt v4, där Åmål används som kvalitativ benchmark och endast **kända väsentliga luckor** blockerar GRÖNT, blir resultatet:

- **11 GREEN**
- **10 YELLOW**
- **0 RED**

Detta ersätter inte den automatiska `STRICT-LIVE-AUDIT-LATEST.md` ännu, eftersom nuvarande auditmotor fortfarande innehåller äldre fasta miniminivåer och inte är v4-kompatibel.

## Status per kommun

| Kommun | Status | Bedömning |
|---|---|---|
| Åmål | 🟢 GREEN | Kalibreringskommun. Bred och balanserad lokal täckning utan känd väsentlig lucka. |
| Årjäng | 🟢 GREEN | Stark lokal bredd över jobb, event, nyheter, fritid och föreningar. Ingen konkret väsentlig lucka verifierad. |
| Bengtsfors | 🟡 YELLOW | Bostäder: konkreta privata kandidater hos Stendalen, Hänsjön och BBF saknas i DinPuls och kan bara sekundärverifieras. |
| Mellerud | 🟢 GREEN | Balanserad lokal nivå i relation till kommunstorleken och ingen känd konkret väsentlig lucka. |
| Arvika | 🟢 GREEN | Mycket stark bredd i nyheter, vård, service, fritid och föreningar. Lågt bostadsantal är inte i sig blockerande utan aktuell bevisad lucka. |
| Grums | 🟡 YELLOW | Bostäder: flera konkreta aktuella privata kandidater finns utanför de fungerande primärflödena. |
| Säffle | 🟢 GREEN | 61 primärverifierade bostäder och stark lokal bredd. BLOCKED privata värdar utan konkret aktuell verifierad lucka blockerar inte grönt enligt v4. |
| Dals-Ed | 🟢 GREEN | Stark nivå för liten kommun: fungerande bostadsimport, event, lunch och lokal bredd. Ingen känd väsentlig lucka. |
| Eda | 🟢 GREEN | Bred nivå i förhållande till kommunstorleken och ingen verifierad konkret betydande lucka. |
| Filipstad | 🟡 YELLOW | Bostäder: tre Bodil Warmland-objekt har sekundärt verifierats men saknar primärverifierbar import. |
| Forshaga | 🟢 GREEN | Tidigare full lokal produktionsgranskning och stark aktiv data. Föreningsauditens råtal måste tolkas med supplement/importstruktur, men ingen konkret aktuell stor lucka är fastställd. |
| Färgelanda | 🟡 YELLOW | Bostadsflödet har ett kvarvarande separat workflow-/kontrollfel. Live-data finns men aktiv automation är inte fullt frisk. |
| Hagfors | 🟡 YELLOW | Idrott/föreningar: endast 23 i nuvarande audit trots officiellt lokalt föreningsregister och stark indikation på betydligt större verkligt utbud. |
| Hammarö | 🟡 YELLOW | Jobb och bostäder är oproportionerligt tunna; tidigare extern kontroll har visat fler aktuella jobb och privata bostadsaktörer återstår. |
| Karlstad | 🟡 YELLOW | Tydligt underutbyggd i service (8), lunch (4), fritid (8) och föreningar (19) relativt kommunens storlek; bostadsuniversum är dessutom inte komplett. |
| Kil | 🟢 GREEN | Liten kommun med rimligt proportionerlig lokal bredd och ingen konkret verifierad större lucka. |
| Kristinehamn | 🟡 YELLOW | Bostäder: endast Kristinehamnsbostäders primärflöde är fullt integrerat medan flera privata värdar och betydligt större sekundärt utbud är känt. |
| Munkfors | 🟡 YELLOW | Bostäder: DinPuls har 3 från Munkforsbostäder men sekundär kontroll visar ytterligare aktuella objekt hos SM och JPM. |
| Storfors | 🟢 GREEN | Mycket liten kommun med proportionerligt utbud; lunch är uttryckligen verifierad som 2/2 och inga kända väsentliga luckor är fastställda. |
| Sunne | 🟢 GREEN | Bred lokal nivå i relation till storleken och ingen konkret aktuell betydande lucka verifierad. |
| Torsby | 🟡 YELLOW | Trots starkt förbättrad bostadsimport är lunch (1), fritid (2) och föreningar (5) uppenbart för tunt för kommunens verkliga lokala utbud. |

## GREEN – 11 kommuner

Åmål, Årjäng, Mellerud, Arvika, Säffle, Dals-Ed, Eda, Forshaga, Kil, Storfors och Sunne.

## YELLOW – 10 kommuner

Bengtsfors, Grums, Filipstad, Färgelanda, Hagfors, Hammarö, Karlstad, Kristinehamn, Munkfors och Torsby.

## RED – 0 kommuner

Ingen kommun bedöms för närvarande vara så tekniskt eller innehållsmässigt trasig att den ska klassas RED enligt v4.

## Viktiga v4-förändringar jämfört med v3

1. Teoretiskt obevisad fullständighet gör inte längre automatiskt kommunen YELLOW.
2. `BLOCKED` provider är evidens, inte automatiskt statusfel.
3. Konkret sekundärt upptäckta aktuella poster kan däremot skapa YELLOW även om primärkälla saknas.
4. Proportionalitet mot kommunstorlek väger tyngre än absoluta antal.
5. Åmål används som kvalitativ benchmark för mognad, lokal känsla och balans.
6. Uppenbart tunna moduler i större kommuner kan bli YELLOW även utan ett exakt numeriskt registertotal.

## Prioriterade åtgärder

### P1 – Karlstad
Utbyggnad av service, lunch, fritid och föreningar samt fortsatt bostadscoverage.

### P2 – Torsby
Bygg ut lunch, fritid och föreningar. Bostadsdelen är tekniskt betydligt starkare efter Block 3.

### P3 – Bostadsluckor med konkreta kandidater
Bengtsfors, Grums, Filipstad, Kristinehamn och Munkfors.

### P4 – Färgelanda
Reparera det separata bostadsworkflow-/kontrollfelet utan att sänka kvalitetskravet.

### P5 – Hagfors och Hammarö
Hagfors: föreningscoverage. Hammarö: jobb samt fortsatt bostadsverifiering.

## Auditmotor

Den automatiska `scripts/audit_strict_live_100.py` är fortfarande inte v4-kompatibel eftersom den använder gamla fasta minimital som statusgrindar. Den ska därför inte användas ensam för v4-status förrän den byggts om. V4-regeln och denna analys är den aktuella beslutsstandarden tills dess.
