# Arbetsorder Codex – Filipstad till produktionsklar

Datum: 2026-09-03
Repo: `SirElin8290/DinPuls`
Branch: `main`

## Syfte

Slutför endast de kvarvarande Filipstad-luckorna. Gör **inte** en ny full kommunrevision och ändra inte andra kommuner om inte ett regressionstest kräver det. ChatGPT har redan gjort extern research och lagt in servicebreddningen direkt i `data/service-local-supplement.json`.

Direkt genomfört före denna order:
- service/hantverk har breddats med VVS, bygg, bilservice, däck och lokal Lesjöfors-el utöver de befintliga elposterna.
- commit för den direkta breddningen: `0495b5c40171db8e1e5fffbfb3adfe5bcbdc6d00`.

Behåll kirurgiska ändringar. Rekonstruera aldrig stora JSON-filer från trunkerade utdrag.

---

## 1. Lunch – komplettera geografiskt, ingen gissad dagsmeny

Nuvarande Filipstad har fem verifierade källor i `data/lunch-launch-supplement.json`: Café Huset, Hennickehammars Herrgård, Big Hill Lodge, La Strada och Pizzeria Palermo.

Lägg till följande som `source-only` om de inte redan finns i den genererade/merge:ade datan:

### Lesjöfors Grill och Pizzeria
- adress: `Bergslagsgatan 71, 68096 Lesjöfors`
- telefon: `0590-300 03`
- källa: `https://www.visitvarmland.com/filipstad/mat-dryck/restaurang/lesjofors-grill-och-pizzeria`
- verifierat: tis 13–21, ons–fre 11–21, lör–sön 12–21
- formulera inte någon påhittad dagens rätt.

### Café Stationshuset
- adress: `Bergslagsgatan 87, 68096 Lesjöfors`
- telefon: `0590-300 10`
- källa: `https://www.visitvarmland.com/filipstad/de/products/food-drinks/cafe-bakery/cafe-stationshuset`
- café med bland annat räksmörgåsar, baguetter, frallor, panini och våfflor; mat kan förbokas för större sällskap.
- `source-only`.

### Prästbäcksrasta
- ort: Nykroppa
- källa: `https://www.visitvarmland.com/filipstad/boende/stallplatser/stallplatser-prastbacken`
- restaurang/café vid Prästbäcken, 680 90 Nykroppa.
- Lägg endast till om lunchmodulens innehållsregler accepterar restaurang/café utan verifierad daglig lunchmeny. Annars lämna den utanför och dokumentera varför.

Målet är att lunch inte bara representerar Filipstads tätort utan även minst Lesjöfors, och Nykroppa när källkvaliteten räcker.

Kör lunchens relevanta test/update så att supplementet faktiskt når `data/lunch.json`.

---

## 2. Nyheter – byt Filipstad till kommunens officiella RSS

Filipstads kommun dokumenterar själv sin öppna data här:
`https://www.filipstad.se/toppmeny/kommunochpolitik/omkommunen/kommunensoppnadata/nyhetevenemangsfloden.9134.html`

Officiell RSS-länk som kommunens sida länkar till:
`https://www.filipstad.se/4.165e7fd617085b4a5fc104c1/12.165e7fd617085b4a5fc104c9.portlet?state=rss&sv.contenttype=text%2Fxml%3Bcharset%3DUTF-8`

Nuvarande config använder startsidan + `/nyheter/`. Uppgradera Filipstad till RSS om den befintliga nyhetsarkitekturen stödjer feed-källor. Om det kräver ett litet Filipstad-specifikt adaptersteg, implementera det utan att påverka andra kommuner.

Krav:
- endast aktuella Filipstad-nyheter,
- behåll ortsalias `filipstad`, `lesjöfors`, `nordmark`, `persberg`, `nykroppa`, `brattfors`,
- inga gamla/statiska startsideträffar,
- regressionstest för Filipstad.

---

## 3. Evenemang – använd kommunens officiellt dokumenterade Turid-JSON

Kommunens öppna-data-sida länkar explicit till Visit Filipstads JSON-flöde:
`https://turid.visitvarmland.com/api/v8/events?categories=evenemang&lang=sv&municipalities=filipstad`

Aktivitetsflöde:
`https://turid.visitvarmland.com/api/v8/products?lang=sv&municipalities=filipstad`

Nuvarande Visit Värmland-källa är redan korrekt i municipality-config. Kontrollera först om generiska `update-events` faktiskt använder denna Turid-källa för Filipstad. Om inte: lägg till den lättaste möjliga adaptern.

Krav för event:
- framtida/aktuella event,
- original-URL,
- titel, datum/tid, plats och kategori där källan ger det,
- deduplicering,
- filtrera passerade event,
- ingen HTML-skrapning om Turid-JSON fungerar.

Aktivitetsflödet ska **inte** blandas in i evenemangslistan. Använd det endast om nuvarande fritidsarkitektur har en naturlig plats för det.

---

## 4. Föreningar/sport – ersätt den generiska startsidan som föreningsingång

Nuvarande Filipstad-config har för generisk `associationDirectoryUrl: https://www.filipstad.se/` och `associationImport.parser: manual`.

Använd i första hand kommunens riktiga föreningssida:
`https://www.filipstad.se/toppmeny/upplevaochgora/foreningsverksamhet.911.html`

Kommunen uppger där ett 50-tal idrotts-/fritidsföreningar och verksamhet inom bl.a. fotboll, ishockey, bandy, innebandy, tennis, skidåkning, friidrott, orientering, simning, ridning, skytte, fiske och motorsport.

Sport/fritid officiell ingång:
`https://www.filipstad.se/toppmeny/upplevaochgora/sportochfritid.2155.html`

Idrottshallar/anläggningar med geografisk spridning:
`https://www.filipstad.se/toppmeny/upplevaochgora/sportochfritid/idrottshallar.3239.html`

Verifierade orter/anläggningar:
- Filipstad: Ferlinhallen, Spångbergshallen, Filipstads sporthall, Åsenskolans gymnastiksal, Kalhyttan.
- Lesjöfors: Lesjöforshallen.
- Nordmark: Nordmarks skolas gymnastiksal.
- Nykroppa: Nykroppahallen.

Mål:
- byt `associationDirectoryUrl` från startsidan till föreningsverksamhetssidan,
- om maskinläsbart föreningsregister saknas: behåll manual parser men kurera verkliga föreningar från befintlig data/officiella källor,
- säkerställ att sport/fritid visar verkligt lokal täckning också utanför centralorten,
- inga påhittade föreningar.

---

## 5. Bio Monitor – automatisk programimport

Nuvarande `data/cinemas.json` har korrekt baspost:
- `Bio Monitor`
- `Folkets Hus, Viktoriagatan 8, Filipstad`
- `https://www.biomonitor.se/`

Men Filipstad saknar `films`, `showtimes`, `programSource`, `programCheckedAt` och automatisk framtidsfiltrering som Dals-Ed har.

Implementera en liten Bio Monitor-import, helst genom att återanvända mönstret från befintliga biouppdaterare och **utan** att skriva över övriga kommuners bioposter.

Krav:
- endast verkliga aktuella/framtida visningar,
- titel + datum/tid + direkt program-/boknings-URL när källan erbjuder den,
- filtrera passerade visningar,
- bevara baspostens features,
- `programStatus`/motsvarande ska visa tydligt om importen misslyckas,
- automatisk workflow-körning tillsammans med ordinarie biouppdatering, inte ett duplicerat konkurrerande schema om det kan undvikas,
- regressionstest för Filipstad och skydd för Dals-Ed/Bengtsfors nuvarande program.

Källor att börja från:
- `https://www.biomonitor.se/`
- Visit Filipstad/Visit Värmlands Filipstad-evenemang kan användas som sekundär kontroll, inte som ersättning om Bio Monitor har bättre förstahandsdata.

---

## 6. Jobb – endast verifiering/fix om det faktiskt behövs

Filipstad ska ge korrekta lokala Platsbanken-träffar. Gör **inte** en ny jobblösning om generiska pipen redan fungerar.

Kontrollera:
- att `data/jobs.json` innehåller Filipstad,
- att träffarna faktiskt har municipality/workplace Filipstad eller relevanta orter i kommunen,
- att inga grannkommuner läcker in.

Om municipality-ID saknas i config men generiska flödet ändå ger korrekta resultat: lämna arkitekturen i fred. Om Filipstad är tom/fel, lägg in korrekt ID på minsta säkra sätt och kör jobbtestet.

---

## 7. Bostäder – verifiera, bygg inte om

Källan är redan:
- provider: `Filipstadsbostäder`
- mode: `automatic-filipstad`
- `https://www.filipstadsbostader.se/ledigt/lagenhet`

Det här ska bara smoke-testas. Bygg inte om en fungerande importer.

Verifiera att aktuell output fortfarande innehåller riktiga objekt med adress, rum, yta/hyra/tillträde när källan ger det och att orter som Lesjöfors, Nykroppa och Persberg kan förekomma.

---

## 8. Service – redan breddat av ChatGPT, bara testa

Direkt ändring finns i `data/service-local-supplement.json` från commit `0495b5c40171db8e1e5fffbfb3adfe5bcbdc6d00`.

Nya Filipstad-poster:
- Pe Be's VVS AB / Bad & Värme Filipstad – VVS.
- Filipstads Bilservice – bilservice.
- Skalares Däckservice AB / First Stop Filipstad – däck.
- Törnbloms Vulk Filipstad / Däckpartner – däck.
- TKI Bygg AB – bygg.
- M Degerstedt Bygg AB – bygg.
- Lesjöfors El-Jour AB – el i Lesjöfors.

Befintliga launch-poster:
- Dahlöv Elkonsult AB.
- HJF Elkonsult.

Gör endast:
- schema/JSON-test,
- dedupe-test,
- kontroll att `service-page.js` laddar `data/service-local-supplement.json` (det gör den i nuvarande kod),
- kontroll att Filipstad nu har minst kategorierna el, VVS, bygg och bil/däck.

Ändra inte posterna utan konkret verifieringsfel.

---

## 9. Sluttest / readiness

Kör endast relevanta testsviter plus ordinarie readiness/launch-validering.

Filipstad får lämna pilot först när följande är grönt:
1. bostäder fungerar,
2. lokala jobb verifierade,
3. evenemang automatiska och aktuella,
4. nyheter från stabil officiell källa,
5. lunch har Filipstad + Lesjöfors och rimlig geografisk täckning,
6. Bio Monitor har automatisk aktuell programdata,
7. vård är fortsatt bred och oförändrat korrekt,
8. service har minst el/VVS/bygg/bil-däck,
9. förening/sport använder verklig lokal källa och inte kommunstartsidan som skenregister,
10. transport/väder/Missing People fortsatt gröna,
11. Pages/site validation grönt.

När allt ovan passerar:
- flytta Filipstad från `Pilotkommuner` till `Produktionskommuner` i `docs/21-KOMMUNER-STATUS.md`,
- lägg en kort Filipstad-verifieringsnotis med datum,
- committa/pusha till `main`.

## Rapportera tillbaka kort

Rapporten ska bara innehålla:
- ändrade filer,
- antal Filipstad-poster: lunch, bio-visningar, events, service/förening där relevant,
- jobb/bostäder verifierade ja/nej + antal aktuella träffar,
- tester/workflows/Pages status,
- slutstatus: `Filipstad produktionsklar` eller exakt blockerare,
- commit SHA.
