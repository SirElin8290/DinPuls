# DinPuls företagssjälvservice: etapp 2

Det tidigare tekniska förarbetet återanvänds. Företagsentrén finns nu på
`foretag/start.html`, och sidfotens Företag-länk leder dit. Befintliga kunder
loggar in med portalens ordinarie autentisering. Nya kunder får först ett
verifierat konto via engångslänk och lösenord och kan sedan välja platser.

## Implementerat bakom feature flags

- Företagsregistrering, aktiveringsmejl och inloggning återanvänder
  `business_users`. Formell organisationsnummerkontroll verifierar format och
  kontrollsiffra, inte bolagets existens eller företrädarens behörighet.
- Servern visar lediga platser och håller en vald period i D1 under checkout.
  Hållna platser skyddas atomiskt mot andra självserviceorder och äldre
  avtalsreservationer. En första order kan innehålla flera kommuner i ett och
  samma låsta v4.1-avtalssnapshot med pris, moms, period och platser.
- Företagets företrädare granskar samma snapshot och ritar sin signatur.
  Signaturen arkiveras i R2. En DinPuls-företrädare granskar sedan snapshoten
  i admin och signerar för DinPuls; därefter skapas den signerade PDF:en och
  beständiga purchaseposter. Ingen DinPuls-signatur simuleras.
- En separat privat R2-bucket, `dinpuls-contract-signatures`, innehåller
  SirElin AB:s godkända fasta PNG-signatur under
  `approved/sirelin-ab/v1.png`. Bucketen saknar både r2.dev-adress och
  ansluten publik domän. Originalets SHA-256 är
  `3055a756094c8bcc6166517a61d3deb484a85ac43d5dd2043b82b1b23b9a38f1`.
  När `SELF_SERVICE_FIXED_SIGNATURE_ENABLED=true` kontrollerar Worker R2-bytes
  mot detta hashvärde och låser signaturens identitet i det nya grundavtalets
  snapshot. Endast ägaren till det reserverade utkastet kan se bilden genom
  en autentiserad endpoint med `private, no-store`. Originalet ligger aldrig
  i repo eller publik annonsasset. Kundens signering kan tekniskt låsa PDF,
  purchaseposter och avtalsstatus i ett flöde med denna redan godkända
  motpartssignatur. Gamla/adminskapade avtal följer fortsatt den ordinarie
  manuella dubbelsigneringen.
- En kund med signerat grundavtal kan bekräfta tilläggsköp inne i portalen utan
  ny grundavtalssignatur. Varje tillägg har en uttrycklig, hashad
  orderbekräftelse och separata purchaseposter per kommun, plats och period.
  Portalen visar köpen och deras publicerings-/faktureringsstatus.
- Banners knyts till rätt purchase och kommun. Nya köp väntar på särskilt
  adminbeslut innan annonsen kan publiceras. Den äldre avtalsstyrda
  bannerfunktionen för befintliga kunder finns kvar.
- Fakturaunderlag kan läsas av admin från beständiga purchaseposter.
  `cloudflare/spiris-adapter.js` gör bara en lokal mappning; inga fakturor
  skickas och inga Spiris-anrop görs.

`migrations/0002_self_service_orders.sql` skapar de nya D1-tabellerna,
indexen och överlappsskyddet. Worker kan skapa dem vid körning. Ändringen i
`migrations/0003_banner_purchase_link.sql` lägger till två kolumner i
`ad_banners` och ska köras en gång; Worker kan också lägga till dem via PRAGMA.
Kör aldrig ALTER-satserna igen om kolumnerna redan finns.

## Aktivering och kvarvarande beslut

`SELF_SERVICE_SIGNUP_ENABLED` och `SELF_SERVICE_PURCHASE_ENABLED` är avstängda
som standard. Publik registrering och köp öppnas först när verksamhetsägaren
har granskat signering och tilläggsbekräftelse samt skarp drift är verifierad.
`SELF_SERVICE_FIXED_SIGNATURE_ENABLED` är också avstängt tills v4.1:s
signeringsformulering har godkänts för en förhandsgodkänd fast signatur.
`SPIRIS_ENABLED` är fortfarande avstängt. Inga skarpa fakturor kan skickas.

Den nuvarande v4.1-texten ger två frågor som inte ska besvaras genom en tyst
avtalsändring: punkt 1 begränsar grundavtalet till angivna platser, period och
villkor; punkt 6 säger att ändrat antal platser ska dokumenteras i nytt avtal
eller ny skriftlig överenskommelse; punkt 7 kräver båda parters godkännande av
väsentliga ändringar och skriftlig dokumentation. Verksamhetsägaren behöver
granska om den autentiserade tilläggsordern och DinPuls acceptans uppfyller
detta, eller om separat tilläggsavtal behövs. Punkt 8 säger i dag att båda
parter undertecknar elektroniskt, att respektive part genom underskriften
bekräftar att den har tagit del av det aktuella avtalet, och att avtalet blir
bindande när båda parter undertecknat det. En signatur som godkänts innan ett
individuellt avtal finns behöver därför uttryckligen beskrivas som SirElin
AB:s förhandsgodkännande för just denna självserviceprocess och avtalet
behöver säga när kundens underskrift gör avtalet bindande. Ingen sådan
juridisk ändring har gjorts i v4.1. Därför är automatisk motpartssignering
tekniskt testad men inte aktiverad live; manuellt steg kvarstår i skarp drift.

Registreringens tekniska ordning är aktiveringsmejl och lösenord före
beställning och signering. Det gör företrädarens e-post verifierbar innan en
bindande beställning tas emot. Det avviker från den önskade ordningen där
aktivering sker efter första signeringen.
