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
`SPIRIS_ENABLED` är fortfarande avstängt. Inga skarpa fakturor kan skickas.

Den nuvarande v4.1-texten ger två frågor som inte ska besvaras genom en tyst
avtalsändring: punkt 1 begränsar grundavtalet till angivna platser, period och
villkor; punkt 6 säger att ändrat antal platser ska dokumenteras i nytt avtal
eller ny skriftlig överenskommelse; punkt 7 kräver båda parters godkännande av
väsentliga ändringar och skriftlig dokumentation. Verksamhetsägaren behöver
granska om den autentiserade tilläggsordern och DinPuls acceptans uppfyller
detta, eller om separat tilläggsavtal behövs. Den första ordern kräver också
en verklig DinPuls-företrädare som motpartssignerar. Det är ett kvarvarande
manuellt steg i den önskade helt automatiska nykundsresan.

Registreringens tekniska ordning är aktiveringsmejl och lösenord före
beställning och signering. Det gör företrädarens e-post verifierbar innan en
bindande beställning tas emot. Det avviker från den önskade ordningen där
aktivering sker efter första signeringen.
