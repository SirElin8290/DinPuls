# DinPuls – status för 21 kommuner

Senast uppdaterad: 2026-09-01

Detta dokument är den gemensamma sanningskällan för kommunutbyggnaden. En kommun räknas inte som produktionsklar bara för att den finns i väljaren. Produktionsläge kräver verklig lokal data, fungerande automation och godkänd readiness-audit.

## Målområde

DinPuls ska täcka samtliga 16 kommuner i Värmlands län samt de fem Dalslandskommunerna Åmål, Bengtsfors, Mellerud, Dals-Ed och Färgelanda.

Totalt: 21 kommuner.

## Produktionskommuner

- Åmål
- Säffle
- Bengtsfors
- Mellerud
- Årjäng
- Arvika
- Grums
- Eda

## Pilotkommuner

- Kil
- Sunne
- Karlstad
- Hammarö
- Forshaga
- Kristinehamn
- Storfors
- Filipstad
- Hagfors
- Munkfors
- Torsby
- Dals-Ed
- Färgelanda

## De 11 nya kommunerna – implementerat 2026-09-01

Samtliga elva finns nu i `data/municipalities.json` med:

- namn, slug, kommunkod och län
- koordinater och officiell kommunwebb
- lokala orts-/sökalias
- officiell kommunal nyhetskälla
- evenemangskällor
- föreningsregister eller officiell föreningsingång
- bostadsaktör eller officiell bostadsingång
- grannkommuner
- pilotspärr så att kommunen inte kan förväxlas med produktionsklar kommun

De elva är:

1. Karlstad
2. Hammarö
3. Forshaga
4. Kristinehamn
5. Storfors
6. Filipstad
7. Hagfors
8. Munkfors
9. Torsby
10. Dals-Ed
11. Färgelanda

## Automatisk grunddata

Efter registreringen har DinPuls befintliga workflows börjat skapa/synka grunddata för de nya kommunerna. Bland de automatiska flöden som redan aktiverats finns:

- väder
- vägtrafik
- buss/tåg
- tank- och laddstationer
- bostadsskal/källor
- dagens viktigaste / gemensamma grunddata

Nyheter, evenemang, lunch och föreningar är kopplade till kommunregistret och körs även fortsättningsvis genom sina centrala updater-flöden.

Jobb-workflowen har kompletterats så att även ändringar i `data/municipalities.json` triggar en jobbuppdatering direkt, i stället för att en ny kommun behöver invänta nästa schemalagda körning.

## Vård och hälsa

`data/health.json` innehåller nu minst en verifierad officiell vårdaktör för samtliga 21 kommuner. Detta är en baslinje, inte ett påstående om fullständig vårdtäckning. Större kommuner, särskilt Karlstad, ska ha bredare täckning innan de lämnar pilot.

## Readiness-princip

Kommunstorlek påverkar naturligt hur mycket lokalt innehåll som finns. DinPuls kräver därför inte samma absoluta antal poster i varje kommun.

Kravet är i stället:

- relevant lokal täckning i relation till vad som faktiskt finns
- inga tekniskt tomma moduler som ser ut som legitima nollresultat
- live-väder
- fungerande trafik/transport där sådan data finns
- lokala jobbresultat när jobb finns
- bostadskälla och fungerande import när en maskinläsbar källa finns
- lokala evenemang när källor finns
- trovärdig lunchnivå i förhållande till kommunens utbud
- sport/fritid från verkliga föreningar
- lokala nyheter
- verklig vårddata
- användbar service-/hantverkskatalog

`scripts/audit_municipality_readiness.py` rapporterar nu automatiskt datagap för samtliga pilotkommuner, inte bara för en enskild kommun.

## Kvar innan de 11 nya kan lämna pilot

Varje kommun ska granskas utifrån auditens faktiska resultat. Typiska kvarvarande arbeten är:

- verifiera att nyhetsimporten ger färska lokala träffar
- verifiera att jobbflödet ger korrekt kommunträff
- verifiera/importera lokala evenemang
- hitta maskinläsbar bostadskälla där det är möjligt
- fylla service och hantverk med verifierade lokala företag
- importera eller kurera sport- och fritidsföreningar
- lägga till proportionerligt lunchutbud där sådant finns
- fördjupa vårdtäckningen i större kommuner
- mobil/desktop-smoke-test av kommunval och alla centrala moduler

Pilotstatus tas bort först när kommunen känns verkligt lokal, aktuell och användbar för en person som bor där.
