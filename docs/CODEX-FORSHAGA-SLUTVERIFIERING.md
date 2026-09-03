# Codex-arbetsorder – Forshaga slutverifiering

Repo: `SirElin8290/DinPuls`
Branch: `main`

## Syfte

Forshaga är redan tekniskt och datamässigt genomarbetad i chatten och ska **inte byggas om från noll**. Den här arbetsordern är till för slutlig QA, livekontroll och endast de korrigeringar som faktiskt behövs för att kunna bocka av Forshaga helt.

## Börja med detta

1. Synka mot aktuell `main`/HEAD.
2. Inventera vad som redan är gjort för Forshaga och jämför mot aktuell kod/data innan du ändrar något.
3. Behåll fungerande implementationer och skriv inte över senare globala ändringar i layout, dark mode, hösttema, sportmoduler, annonser eller andra gemensamma funktioner.

## Redan genomfört och ska i första hand verifieras – inte göras om

- Automatisk Forshagabostäder-import är kopplad till bostadsworkflow och har publicerat riktiga objekt med adress, område, rum, yta, hyra, våning, inflyttning och direktlänk.
- Forshagas FRI-föreningsregister är automatiskt importerat och kopplat till föreningsworkflow.
- Senaste verifierade föreningsresultat var 22 idrottsföreningar och 34 fritids-/föreningsposter efter normalisering.
- Forshaga Folkets Hus Bio är kopplad till verifierade lokala evenemang och har automatisk import av framtida filmer/visningar.
- Service/hantverk har breddats till användbar lokal täckning.
- Readiness-audit har rapporterat Forshaga med lokal data för jobb, väder, trafik, bostäder, evenemang, lunch, sport, fritid, nyheter, vård och service.
- Forshaga har flyttats till produktionskommuner i `docs/21-KOMMUNER-STATUS.md`.

## Din uppgift

### 1. Live-QA i riktig browser

Öppna Forshaga som vald kommun på den publicerade sajten och verifiera både desktop och mobil/responsivt läge.

Kontrollera minst:

- kommunvalet verkligen visar Forshaga och inte Åmål/defaultdata,
- startsidan,
- väder,
- trafik och kollektivtrafik,
- bostäder,
- jobb,
- evenemang,
- lunch/restaurang,
- bio,
- vård & hälsa,
- service & hantverk,
- idrott & motion,
- en eller flera individuella sportvyer,
- fritid & föreningsliv,
- nyheter,
- Missing People och övriga centrala lokala moduler som finns i Forshagavyn.

Kontrollera att inga uppenbara Forshaga-specifika layoutfel, tomma moduler, fel kommunnamn, felaktiga länkar, osynlig text, dark-mode-problem eller mobilproblem finns.

### 2. Verifiera aktuell data/output

Kontrollera från aktuell HEAD att Forshaga fortfarande har fungerande aktuell output. Verifiera särskilt:

- bostadsimporten och antal aktuella Forshagabostäder,
- FRI-importen och att sport/fritid faktiskt renderar Forshaga-föreningar,
- bioimporten med endast framtida visningar,
- jobbresultat för Forshaga/Deje,
- evenemang och direkta källänkar,
- service/hantverk,
- vård,
- lunch,
- lokala nyheter,
- trafik/transport.

Använd inte gamla hårdkodade siffror som krav om källorna naturligt har ändrats. Kravet är korrekt och aktuell lokal output.

### 3. Tester och workflows

Kör relevanta tester från aktuell `main`, inklusive ordinarie launch/readiness-kontroller och de Forshaga-specifika tester som finns.

Verifiera att relevanta workflows är gröna, särskilt:

- bostäder,
- föreningar/idrott,
- bio,
- launch/readiness,
- GitHub Pages-publicering.

### 4. Rätta endast verkliga fel

Om live-QA eller tester hittar ett konkret fel: rätta det kirurgiskt, testa igen och behåll fungerande gemensam arkitektur.

Gör **inte** generell redesign eller ny research om det inte behövs för ett faktiskt verifierat fel.

## Godkännandekriterium

Forshaga får bockas av helt när:

- livevyn fungerar i desktop och mobil,
- Forshaga-specifik data visas korrekt,
- centrala moduler inte har blockerande fel,
- relevanta tester/workflows är gröna,
- Pages-publiceringen är verifierad.

Om allt är grönt behövs ingen ytterligare utveckling för Forshaga.

## Slutrapport

Rapportera kort och konkret:

1. aktuell HEAD du startade från,
2. vad som redan var korrekt när du började,
3. vilka livekontroller du genomförde,
4. eventuella fel du hittade,
5. eventuella filer/commits du ändrade,
6. aktuell Forshaga-output med relevanta antal,
7. tester och workflows med resultat,
8. Pages-status,
9. slutlig HEAD SHA,
10. tydlig slutsats: `FORSHAGA GODKÄND OCH STÄNGD` eller exakt vad som fortfarande blockerar.
