# DinPuls mobilapp – utveckling

Appkod i separat mapp, befintlig webbplats och backend återanvänds. App-ID `se.dinpuls.app` är ett utvecklingsval och ännu inte registrerat i någon butik.

## Körning

Node 22 eller senare: `npm ci`, `npm run build`, `npm test`, `npx cap sync`.
Android: öppna med `npm run android`; kräver kostnadsfria Android Studio/SDK och JDK 21.
iOS: öppna med `npm run ios` på Mac med Xcode. Simulatorbygge behöver inget betalt utvecklarkonto.

GitHub bygger debug-APK, permanent signerat Android App Bundle och release-APK efter godkända Androidtester och osignerad simulatorapp på appbranchen. Inga butikskonton, betalningar eller produktionsdeploy görs. Standardrunners är kostnadsfria i detta publika repo. Artefakter sparas i tre dagar.

## Arkitektur

Publik HTML, JavaScript, CSS och befintliga bilder paketeras från Git-spårade filer. Inga backendfiler, secrets eller dynamiska meny-/nyhetsdata packas. JSON från `/data/` hämtas från `https://dinpuls.se` varje gång via Capacitors officiella native HTTP-bridge. Befintliga tokenbaserade API-anrop återanvänds. Inga CORS- eller autentiseringskontroller ändras i backend.

Mobilnavigation, Androids bakåtknapp, säkra externa länkar och internetstatus är appspecifika. Kommunbyte uppdaterar navigationen direkt. Paketerade DinPuls-länkar stannar i appen. Tangentbordet döljer bottennavigationen och gör formuläret scrollbart medan det är öppet. Android-emulatorn testar start, live-data, undersidor och tangentbord på emulatorns telefonstorlek; skärmbilder sparas i byggjobbet. Konton och kommunval använder befintliga flöden. Aktiveringsmejl öppnas fortfarande på webbplatsen; verifierade HTTPS-applänkar återstår inför lansering. Android och iOS registrerar även `dinpuls://app/<paketerad-sida>.html`; endast paketerade sidor tillåts, och query/hash bevaras. Befintliga mejl har inte ändrats till detta länkschema.

## Kvar inför lansering

- Verifiera rendering, tangentbord, login, uppladdning och session på verklig Android och iPhone.
- Androids Firebase-klient och serveranslutning är konfigurerade. Faktisk mottagning på telefon, särskilt med stängd app, återstår att verifiera. Automatisk utskicksmotor är publicerad; utskick väljs efter prenumerantens kommun och kategorier.
- Verifierade applänkar, konto-/integritetskrav och full butikstestning.
- Butiksgodkända ikonresurser, appmetadata, release-signering och utvecklarkonton när användaren vill publicera.

En lyckad kompilering är inte ett godkänt fullständigt E2E-test. Första versionen är en testapp.

## Verifieringsgräns för push

Webbpush använder befintlig VAPID-konfiguration. Android använder Firebase-projektet `dinpuls-57683` och app-ID `se.dinpuls.app`; serverns native-konfiguration bekräftar Android-stöd. Tillstånd begärs först när användaren väljer att ansluta notiser. Enhetstoken och valda kategorier registreras, och avslutad prenumeration raderas. Lokala tester verifierar dessa klientflöden samt synlig notis i öppen app; detta bevisar inte verklig leverans. iOS-klient och serverkod är förberedda, men Apple/APNs-konfiguration och fysisk mottagning saknas.

För iPhone krävs APNs-capability, korrekt signing och servernyckel. En levererad notis med appen stängd måste därefter verifieras på en faktisk enhet. Befintliga webbprenumerationer lämnas orörda.

## Isolerad Androidverifiering

Instrumenteringen använder en separat lokal D1/R2-backend och fångar mejlanrop utan externa utskick. Testet kontrollerar registrering, aktivering, lösenordsbyte och sessionsspärr, login, portalvyer, köp/signatur, PDF, banneruppladdning, granskning och publicerad bild. Testkopplingen paketeras endast i instrumenteringsvarianten, aldrig i den distribuerade APK/AAB-filen. Ett godkänt testresultat måste kontrolleras i aktuell GitHub Actions-körning.

Avtals-PDF kan sparas och delas via telefonens filfunktioner. Ordinarie bildgräns och format återanvänds: PNG/JPG/WebP, högst 5 MB. GIF/video har inte lagts till.

Permanent release-signering är genomförd efter uttryckligt godkännande. Krypterad nyckel och lösenord lagras i GitHub Actions secrets; privat lokal reservkopia ligger utanför repot. GitHub verifierar både APK-signatur och AAB-signatur. Första installationen av den permanent signerade APK-filen kan kräva avinstallation av den tidigare debugsignerade testappen.

Automatisk pushmotor körs på produktion var tionde minut, filtrerar kommun/kategorier, etablerar baslinje utan historiska utskick, samlar per kategori och kommun högst en gång per timme och har dubblettskydd samt avregistrering av utgångna token. Aktuella offentliga flöden för nyheter, evenemang, jobb, bostäder, trafik, kollektivtrafik och sport används. Varningar gissas aldrig från väderprognoser eller nyckelord; särskilda varningskategorier kräver uttryckligt klassad och verifierad myndighetsinformation. Första produktionskörningen kontrolleras separat via /push/status. Fysisk mottagning återstår som eget test. Inget butikskonto har skapats.

## iPhone: förberedelse utan betalt konto

Efter `npx cap sync ios` körs `node scripts/prepare-ios.mjs`. Firebase Core/Messaging är låsta till 12.19.1. AppDelegate kopplar APNs till Firebase och skickar FCM-token till Capacitor. Råa APNs-token godtas inte av backend. Inga rättigheter eller token begärs vid första appstart; användaren måste välja notiser. Utan Firebase-konfiguration eller aktiverad server visas ett ärligt installationsläge.

När Apple-kontot finns: registrera iOS-appen `se.dinpuls.app` i Firebase-projekt `dinpuls-57683`, lägg GoogleService-Info.plist i GitHub-secreten `IOS_GOOGLE_SERVICE_INFO_PLIST`, koppla APNs-nyckeln i Firebase och välj rätt Apple-team/provisioning. Debug har development-entitlement och release production-entitlement. Aktivera serverns `IOS_PUSH_ENABLED` först när dessa förutsättningar är uppfyllda. Kod och tester stöder båda plattformarna; flaggan är fortfarande false i produktion.

CI bygger först en normal simulatorapp utan testbrygga. Därefter kompileras en separat isolerad variant med `IOS_CI` endast på app-targeten och lokal HTTP endast i testvarianten. Den driver riktig WKWebView på två iPhone-storlekar, återanvänder Androids konto-/köp-/bannertest och sparar rapporter/skärmbilder. Simulatorarkivet kan inte installeras på en fysisk iPhone. Verklig notismottagning, mejlinkorg och Apples godkännande är separata återstående verifieringar.

Butiksunderlag finns i `store/ios-metadata.json`. Detta är ett utkast, inte en inlämning. Annonsköpet måste lösas enligt [Apples regel 3.1.3(g)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods) före butikslansering: köp av annonser som visas i samma app omfattas av reglerna för köp i appen. Befintligt köpflöde har inte ändrats till IAP och ingen avgiftsbelagd tjänst har startats.
