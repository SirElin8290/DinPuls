# DinPuls mobilapp – utveckling

Appkod i separat mapp, befintlig webbplats och backend återanvänds. App-ID `se.dinpuls.app` är ett utvecklingsval och ännu inte registrerat i någon butik.

## Körning

Node 22 eller senare: `npm ci`, `npm run build`, `npm test`, `npx cap sync`.
Android: öppna med `npm run android`; kräver kostnadsfria Android Studio/SDK och JDK 21.
iOS: öppna med `npm run ios` på Mac med Xcode. Simulatorbygge behöver inget betalt utvecklarkonto.

GitHub bygger debug-APK och osignerad simulatorapp på appbranchen. Inga butikskonton, betalningar eller produktionsdeploy görs. Standardrunners är kostnadsfria i detta publika repo. Artefakter sparas i tre dagar.

## Arkitektur

Publik HTML, JavaScript, CSS och befintliga bilder paketeras från Git-spårade filer. Inga backendfiler, secrets eller dynamiska meny-/nyhetsdata packas. JSON från `/data/` hämtas från `https://dinpuls.se` varje gång via Capacitors officiella native HTTP-bridge. Befintliga tokenbaserade API-anrop återanvänds. Inga CORS- eller autentiseringskontroller ändras i backend.

Mobilnavigation, Androids bakåtknapp, säkra externa länkar och internetstatus är appspecifika. Kommunbyte uppdaterar navigationen direkt. Paketerade DinPuls-länkar stannar i appen. Tangentbordet döljer bottennavigationen och gör formuläret scrollbart medan det är öppet. Android-emulatorn testar start, live-data, undersidor och tangentbord vid 390 × 844; skärmbilder sparas i byggjobbet. Konton och kommunval använder befintliga flöden. Aktiveringsmejl öppnas fortfarande på webbplatsen; verifierade HTTPS-applänkar återstår inför lansering. Android och iOS registrerar även `dinpuls://app/<paketerad-sida>.html`; endast paketerade sidor tillåts, och query/hash bevaras. Befintliga mejl har inte ändrats till detta länkschema.

## Kvar inför lansering

- Verifiera rendering, tangentbord, login, uppladdning och session på verklig Android och iPhone.
- Native push-notiser är ännu inte kopplade; befintlig webbpush ersätter inte native push.
- Verifierade applänkar, konto-/integritetskrav och full butikstestning.
- Butiksgodkända ikonresurser, appmetadata, release-signering och utvecklarkonton när användaren vill publicera.

En lyckad kompilering är inte ett godkänt fullständigt E2E-test. Första versionen är en testapp.
