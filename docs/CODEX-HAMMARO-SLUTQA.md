# Codex: Hammarö – endast slutlig rendered/live-QA

## Utgångsläge
ChatGPT-arbetet för Hammarö är färdigt på `main`. Börja med att läsa senaste `main` och notera aktuell SHA. Gör **inte om** research, databerikning eller kodarbete som redan är slutfört.

Senast verifierade tekniska bas före denna arbetsorder:
- CI-run `33798631888`: **success**.
- Hammarö readiness: jobb 14, väder live, kollektivtrafik 3 avgångar, evenemang 59, lunch 5, sport 16, fritid 18, nyheter 23, vård 10, service 8, bio 1.
- Hammarö-specifik slutkontroll är grön.
- Hammaröbostäder är medvetet `official-reference`; bygg ingen ny bostadsparser.
- Skoghalls Folkets Hus Bio använder verifierad program-/bokningslänk; bygg ingen ny bioscraper.
- Hero-bilder ingår inte i uppdraget.

## Du får INTE
- göra ny research om Hammarö,
- lägga till fler verksamheter, restauranger, föreningar, vårdgivare eller andra dataposter,
- bygga ny bostads-, bio-, förenings- eller annan importer/parser,
- refaktorera arkitektur eller göra generell kodgranskning,
- ändra andra kommuner,
- göra designförbättringar som inte är ett konkret Hammarö-fel,
- använda äldre `scripts/validate_launch.py` som facit när den motsäger nuvarande aktiva CI/readiness eller beslutad startsideslayout.

## Enda uppgiften
Gör en faktisk rendered/live-QA av **Hammarö** på publicerad webb i desktop och mobil.

Kontrollera endast att:
1. vald kommun verkligen är Hammarö och förblir Hammarö vid navigation,
2. startsidan renderas utan överlapp, kapad text, konstiga tomrum eller trasiga kort,
3. Lunch visar Hammarös 5 verifierade referenser utan påhittade veckomenyer,
4. Service visar Hammarös utbud utan dubbletter,
5. Vård, Sport, Fritid, Bio, Bostäder, Jobb, Evenemang, Trafik, Nyheter, Missing People och Väder renderas och länkar fungerar,
6. kollektivtrafiken använder Skoghall centrum och inte fel hållplats,
7. desktop och mobil inte har något konkret Hammarö-specifikt visuellt eller funktionellt fel.

Om du hittar ett **konkret Hammarö-fel**, rätta endast det felet med minsta möjliga ändring och kör endast direkt relevant test plus befintlig CI. Gör inga extra förbättringar.

Om inga konkreta fel återstår: **stoppa omedelbart**. Leta inte efter fler förbättringar.

## Slutrapport
Rapportera endast:
- om något konkret Hammarö-fel hittades och i så fall exakt vad som rättades,
- slutlig SHA,
- CI-status,
- Pages/publiceringsstatus,
- och om allt är grönt: `HAMMARÖ GODKÄND OCH STÄNGD`.
