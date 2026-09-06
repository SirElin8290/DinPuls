# DinPuls – regelbok för kommunanalys

Detta dokument är den bindande arbetsstandarden för analys, åtgärd och godkännande av kommuner på DinPuls.se.

Regelboken ska läsas innan en ny kommunanalys eller omanalys görs. Tidigare godkända bedömningar får inte nollställas eller bedömas enligt nya kriterier utan att denna fil först ändras genom ett uttryckligt beslut.

## 1. Grundprincip

Målet är att varje DinPuls-kommun ska vara praktiskt användbar för en vanlig besökare. Analysen ska bedöma verklig funktion, relevant innehåll och korrekt kommunanknytning – inte jaga teoretisk perfektion.

Samma standard ska användas för samtliga 21 kommuner.

## 2. Statusfärger

### 🟢 GRÖN – godkänd
En modul är grön när den fungerar och har tillräckligt korrekt och relevant innehåll för kommunen.

Grönt betyder inte att modulen måste innehålla allt som över huvud taget går att hitta. Den ska vara användbar och hålla DinPuls fastställda kvalitetsnivå.

### 🟡 GUL – fungerar men har konkret brist
En modul är gul när grundfunktionen fungerar men det finns en identifierad, konkret innehålls- eller kvalitetsbrist som behöver åtgärdas.

En modul får inte göras gul enbart därför att den inte verifierades på nytt i den senaste analysen.

### 🔴 RÖD – fungerar inte
En modul är röd när den inte fungerar, visar felaktig kommun/data, saknar en nödvändig funktion eller på annat sätt inte kan användas som avsett.

## 3. Grönt består

En redan verifierad grön modul förblir grön tills ett konkret nytt fel eller en konkret ny brist faktiskt har identifierats.

En ny fullanalys innebär INTE att alla tidigare gröna moduler nollställs och måste bevisas från början igen.

Om en tidigare grön modul degraderas ska analysen ange exakt vilket nytt fel eller vilken ny brist som motiverar ändringen.

Osäkerhet eller utebliven omverifiering är inte i sig ett skäl att degradera grönt.

## 4. Bedömningsstandarden får inte ändras mitt i arbetet

Kraven för grönt, gult och rött ska vara desamma mellan kommunerna och över tid.

En kommun får inte plötsligt bedömas hårdare därför att en senare analys råkar vara mer omfattande.

Om kvalitetsstandarden behöver ändras ska det göras som ett medvetet projektbeslut och denna regelbok uppdateras först. Därefter ska konsekvensen för redan godkända kommuner bedömas uttryckligen.

## 5. Vad som inte är blockerande

### Hero
Hero-bilden ingår inte i kommunens godkännandestatus. Den hanteras separat av projektägaren och ska ignoreras vid kommunanalys.

### Matkassen
Matkassen ingår inte i kommunens godkännandestatus och ska inte anges som brist eller blockerare.

### Flyg
Flyg behöver inte vara realtid för att modulen ska kunna vara grön. Korrekt och användbar flyginformation räcker enligt projektets beslutade standard.

### Community / Det pratas om
Avsaknad av en godkänd lokal community-källa blockerar inte grönt. Privata grupper får inte skrapas eller publiceras utan godkännande och innehåll får aldrig fabriceras för att fylla modulen.

### Externa tillfälliga nätverksfel
Ett tillfälligt nätverksfel mot en extern källa innebär inte automatiskt att en kommunmodul är röd om DinPuls implementation är korrekt och en fungerande fallback finns. Ett faktiskt återkommande integrationsfel ska däremot åtgärdas.

## 6. Innehållskrav

En modul ska bedömas utifrån kommunens storlek och verkliga lokala utbud. En liten kommun behöver inte ha samma antal poster som Karlstad.

Det är kvalitet och rimlig täckning som bedöms – inte ett identiskt numeriskt mål för alla kommuner.

Symboliska kompletteringar ska undvikas. Om en modul verkligen är för tunn ska den byggas ut ordentligt med relevanta, verifierbara aktörer, verksamheter, aktiviteter eller källor.

Innehåll får aldrig hittas på för att få en modul grön.

## 7. Verifieringsnivåer – håll dem isär

Följande är olika saker och får aldrig beskrivas som om de vore samma:

1. **Kod/data skapad** – ändringen finns lokalt eller är förberedd.
2. **Commit genomförd** – ändringen finns på GitHub/main.
3. **Aktiv kodväg verifierad** – det är verifierat att den faktiska frontend-/pipeline-koden använder ändringen.
4. **Workflow/runtime verifierad** – automation/import har körts med den nya koden och resultatet har kontrollerats.
5. **Live-verifierad** – den publicerade DinPuls-sidan visar och beter sig korrekt.

En commit får aldrig ensam beskrivas som bevis för att funktionen fungerar live.

Om endast repo-nivån är verifierad ska detta sägas uttryckligen.

## 8. Full kommunanalys

En full analys ska gå igenom alla relevanta DinPuls-moduler för kommunen, bland annat:

- grundkonfiguration och kommunval
- Dagens viktigaste
- väder
- vägtrafik
- kollektivtrafik
- flyg
- jobb
- bostäder
- evenemang
- kommun-/lokalnyheter
- Missing People
- vård & hälsa
- service & hantverk
- myndigheter & samhällsservice
- dagens lunch
- bio
- fritid & aktiviteter
- idrott & föreningar
- community / Det pratas om

Hero och Matkassen undantas enligt ovan.

Analysen ska utgå från senast fastställda status och leta efter konkreta förändringar eller fel. Den ska inte börja med antagandet att tidigare arbete är ogiltigt.

## 9. Åtgärdsprincip

När ett konkret problem hittas ska allt som säkert kan lösas direkt via GitHub göras där utan onödig Codex-/Work-användning.

Codex/annan tyngre exekvering används endast när uppgiften faktiskt kräver det.

Aktiva kodvägar ska prioriteras. Att skapa en supplement-, research- eller datafil som ingen aktiv kod läser räknas inte som att modulen är fixad.

## 10. Rapportering

Kommunarbete ska normalt genomföras utan löpande mellanrapporter. Slutrapporten ska skilja tydligt mellan:

- vad som redan var godkänt,
- vilka konkreta problem som hittades,
- vad som faktiskt åtgärdades,
- vad som är repo-/runtime-/live-verifierat,
- vad som eventuellt återstår.

Överdrivna påståenden om att något är "fixat", "färdigt" eller "grönt" ska undvikas tills den verifieringsnivå som krävs faktiskt är uppnådd.

## 11. Kommunstatus och historik

När en kommun är färdigställd ska dess godkända status betraktas som projektets baseline. Senare analyser får komplettera eller degradera den endast när ett konkret nytt fel hittas.

### Fastställda baselines

- **Hagfors:** 🟢 färdig enligt DinPuls beslutade standard. Accepterade begränsningar ska inte återöppnas som blockerare utan ett nytt projektbeslut eller ett konkret nytt fel.
- **Hammarö:** tidigare genomarbetad/godkänd baseline ska bevaras; en framtida analys får inte nollställa tidigare verifieringar utan konkret anledning.
- **Färgelanda:** tidigare analys hade i huvudsak evenemang och bostäder som återstående konkreta problem. Senare arbete har dessutom byggt ut vård, fritid och idrott. En ny analys får inte göra övriga tidigare gröna moduler gula enbart för att de inte omverifierades i samma genomgång.

Kommunstatus ska uppdateras när ett nytt faktiskt resultat är verifierat. Historiken ska inte skrivas om för att passa en ny bedömningsstandard.

## 12. Konfliktregel

Om en framtida analys, instruktion eller arbetsmetod står i konflikt med denna regelbok ska konflikten uppmärksammas innan status ändras.

Projektägarens senaste uttryckliga beslut har företräde. När ett sådant beslut ändrar den permanenta arbetsstandarden ska denna fil uppdateras så att samma regel används nästa gång.

---

**Praktisk huvudregel:** Läs denna fil först. Behåll redan verifierat grönt. Leta efter konkreta fel. Ändra inte standarden i efterhand. Skilj alltid commit från faktisk funktion.