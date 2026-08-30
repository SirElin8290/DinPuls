# DinPuls – signering, avtalskopia och välkomstmejl

## Mål
När ett nytt annonsavtal slutförs ska kunden och DinPuls ha signerat samma låsta avtalsversion. Därefter ska företaget få två separata mejl:

1. **Välkommen till DinPuls – ert signerade avtal** med signerad avtalskopia.
2. **Skapa ditt lösenord till DinPuls företagsportal** via den redan befintliga säkra aktiveringskedjan.

Lösenordsmejlet finns redan och ska inte skrivas om i denna implementation.

## Önskat signeringsflöde
1. Admin klickar `Nytt avtal`.
2. Steg 1: standardvillkoren gås igenom tillsammans med kunden.
3. Steg 2: företagsuppgifter, kontaktperson, befattning, e-post, telefon, kommun, annonsplatser, pris, avtalsperiod, debitering, förnyelse och eventuell avtalsnotering fylls i.
4. Steg 3: exakt slutlig avtalsversion visas i förhandsgranskning.
5. Steg 4: kundens behöriga företrädare skriver namn och befattning samt signerar med finger/stylus på telefon eller surfplatta.
6. DinPuls företrädare signerar samma avtalsversion.
7. Systemet låser avtalet och sparar en snapshot av exakt innehåll som signerats.
8. Slutlig PDF genereras från den låsta avtalsversionen.
9. PDF sparas i R2 och knyts till avtals-ID.
10. Avtalet får status `Aktivt` först när båda signaturerna är registrerade och PDF-arkiveringen lyckats.
11. Mejlet med välkomsttext och avtalskopia skickas.
12. Det befintliga lösenords-/aktiveringsmejlet skickas separat.

## Uppgifter som ska sparas med signeringen
- avtals-ID
- avtalsversion
- oföränderlig snapshot av företag, organisationsnummer, kontaktperson, befattning, annonsplatser, priser, period, debiteringsform, förnyelse och avtalsnotering
- version/snapshot av standardvillkoren
- kundens signerande namn
- kundens befattning
- kundens signaturdata
- DinPuls signerande namn
- DinPuls signaturdata
- tidsstämpel för respektive signatur i ISO-format
- hash av den slutliga avtals-snapshoten/PDF:en
- R2 object key till den signerade PDF:en
- gärna user-agent och IP-adress som kompletterande revisionsmetadata, om det bedöms lämpligt ur integritetssynpunkt

## Låsningsregel
Efter båda parters signering får ingen befintlig signerad version skrivas över. Ändringar av pris, period, annonsplatser eller villkor ska kräva ny avtalsversion/tilläggsavtal.

## Välkomst- och avtalsmejl

### Ämne
`Välkommen till DinPuls – ert signerade annonsavtal`

### Från
`DinPuls <noreply@dinpuls.se>`

### Innehåll

**Hej [kontaktperson],**

Välkommen till DinPuls.

Annonsavtalet för **[företagsnamn]** är nu signerat och aktivt.

**Avtalsnummer:** [avtalsnummer]  
**Avtalsperiod:** [startdatum] – [slutdatum]  
**Kommun:** [kommun]  
**Annonsplats(er):** [annonsplatser]

En kopia av det signerade avtalet finns bifogad till detta mejl eller via den säkra avtalslänken nedan. Samma signerade avtalsversion ska också finnas tillgänglig i företagets portal.

**[Öppna signerade avtalet]**

Ni får även ett separat mejl från DinPuls med en säker länk för att skapa ert lösenord till företagsportalen. Där kan ni bland annat planera banners, följa statistik och se er avtalsinformation.

Har ni frågor om avtalet eller er annonsering är ni välkomna att kontakta DinPuls.

Vänliga hälsningar  
**DinPuls.se**  
Din kommun. Din vardag.

## Tekniska krav för mejlet
- Skickas via den redan konfigurerade Resend-integrationen.
- Skickas endast efter lyckad dubbel signering och lyckad PDF/R2-arkivering.
- Får inte ersätta eller slå ihop det befintliga lösenordsmejlet.
- Utskicket ska vara idempotent: samma signerade avtalsversion ska inte kunna generera flera identiska välkomst-/avtalsmejl av misstag.
- Om e-postleveransen misslyckas ska avtalet fortfarande förbli signerad/arkiverat och admin ska kunna välja `Skicka avtalskopia igen`.
- PDF-bilaga eller säker tidsbegränsad nedladdningslänk kan användas. Om bilaga används ska samma fil också ligga arkiverad i R2.

## Acceptance criteria för Codex
- Kund kan signera med finger/stylus på mobil och surfplatta.
- DinPuls kan signera samma avtalsversion.
- Avtalet kan inte bli `Aktivt` före båda signaturerna.
- Exakt signerad version låses och hash beräknas.
- PDF skapas och arkiveras i R2.
- Företaget kan öppna/ladda ner samma signerade PDF i portalen.
- Admin kan öppna samma signerade PDF.
- Välkomst-/avtalsmejlet skickas efter signering.
- Befintligt lösenordsmejl fortsätter fungera oförändrat.
- Två separata mejl skickas vid ny onboarding.
- Full testsvit och ett end-to-end-test ska verifiera hela kedjan.
