# DinPuls – STRICT LIVE kommunregel v4

Detta dokument ersätter samtliga tidigare kommunregler och är den enda bindande standarden för att avgöra om en DinPuls-kommun är GRÖN, GUL eller RÖD.

## 1. Syfte

Regeln ska ge en praktiskt användbar produktionsstatus. Den får inte skapa ett läge där nästan alla kommuner blir GULA enbart därför att det teoretiskt kan finnas okända lokala aktörer eller källor som inte går att bevisa bort.

Status ska svara på frågan:

> Om en vanlig invånare öppnar DinPuls för kommunen nu – känns kommunen komplett, lokal, aktuell och användbar på samma kvalitetsnivå som den mest mogna referenskommunen Åmål, utan kända väsentliga luckor eller tekniska fel?

Åmål används som **kalibreringskommun** för kvalitetsnivå och mognadsgrad, inte som numerisk mall.

## 2. Åmål som kalibreringskommun

Åmål är referensen för hur en GRÖN kommun ska upplevas:

- samtliga obligatoriska moduler finns och fungerar,
- kommunen känns lokal i hela användarupplevelsen,
- dynamiska flöden är aktuella,
- bostäder, jobb, evenemang, nyheter, vård, service, lunch, fritid och föreningar har trovärdig bredd i relation till kommunens verkliga storlek och utbud,
- länkar och objekt leder rätt,
- inga kända betydande luckor finns,
- små verkliga utbud accepteras när de är rimliga och korrekt representerade.

Åmåls aktuella antal får aldrig göras till fasta trösklar för andra kommuner. En större kommun kan behöva betydligt fler poster och en mindre kommun betydligt färre.

## 3. Statusdefinitioner

### 🟢 GRÖN – produktionsmässigt komplett

En kommun är GRÖN när:

1. samtliga obligatoriska moduler fungerar tekniskt,
2. rätt kommun och rätt lokala data visas,
3. dynamiska flöden är aktuella och användbara,
4. täckningen är rimligt bred och proportionerlig mot kommunens verkliga lokala utbud,
5. alla kända väsentliga lokala primärkällor eller etablerade ersättningskällor är täckta där de faktiskt publicerar relevant innehåll,
6. det inte finns någon känd betydande innehållslucka,
7. kommunen sammantaget når minst Åmål-nivå i lokal trovärdighet och användbarhet.

GRÖNT kräver inte matematisk bevisning att inga okända aktörer eller poster existerar någonstans.

En relevant aktör utan publik aktuell objektlista, endast telefon/e-postkontakt eller utan belägg för aktuellt utbud blockerar inte automatiskt GRÖNT.

### 🟡 GUL – fungerande men konkret förbättringsbehov

En kommun är GUL när sajten i huvudsak fungerar men det finns minst en konkret eller starkt underbyggd betydande lucka, exempelvis:

- kända aktuella bostäder, jobb, evenemang eller andra poster saknas,
- en väsentlig lokal källa med aktuellt innehåll är känd men inte täckt,
- en modul är uppenbart tunn i relation till kommunens storlek eller verifierade lokala verklighet,
- en parser/import missar delar av en fungerande källa,
- source coverage är så svag att användarupplevelsen inte når Åmål-nivå,
- en viktig modul fungerar men är märkbart ofullständig.

Enbart teoretisk osäkerhet eller en BLOCKED-provider utan belägg för aktuellt innehåll räcker inte för GUL.

### 🔴 RÖD – kritiskt fel eller grovt ofullständig

En kommun är RÖD när minst en central funktion är trasig eller oanvändbar, exempelvis:

- fel kommun eller fel data visas,
- central modul laddar inte,
- viktig källa/parser är trasig och ger felaktigt/tomt resultat,
- stora kända delar av det lokala innehållet saknas,
- data är systematiskt stale eller felaktig,
- navigation/kommunval fungerar inte,
- publicerad liveversion är väsentligt fel jämfört med aktiv datakälla.

## 4. Väsentlig lucka – bindande definition

En lucka räknas som **väsentlig** när minst ett av följande gäller:

- verifierad aktuell primärkälla innehåller relevanta poster som saknas i DinPuls,
- en trovärdig sekundär källa visar konkreta aktuella poster hos en identifierad aktör och dessa saknas i DinPuls,
- en stor eller central lokal aktör/källa saknas helt,
- modulen är uppenbart oproportionerligt tunn jämfört med kommunens storlek och lokala verklighet,
- felaktig pagination, filter, deduplicering eller parser gör att kända delar av källan tappas,
- jämförelse mot officiellt register visar tydlig undercoverage.

En lucka är **inte automatiskt väsentlig** bara för att:

- en liten privat aktör finns på en kommunal lista,
- en aktör saknar publik objektsida,
- det endast finns telefon/e-postkontakt,
- audit inte kan matematiskt bevisa ett fullständigt universum,
- ett absolut antal är lägre än i en annan kommun.

## 5. Proportionalitetsprincip

Kommuner ska bedömas mot sitt verkliga lokala utbud, inte samma numeriska minimikrav.

Exempel:

- Åmål kan vara GRÖN med 4 lunchställen om fyra är ett trovärdigt faktiskt ordinarie utbud.
- Storfors kan vara GRÖN med 2 lunchställen om 2/2 är verifierat och rimligt.
- Karlstad kan inte bli GRÖN med 4 lunchställen om det är uppenbart att ett stort antal relevanta lunchställen saknas.
- Dals-Ed kan vara GRÖN med få jobb om det lokala aktuella utbudet är litet och inga kända betydande jobb saknas.

Fast numerisk minimumgräns får aldrig ensam skapa GRÖNT eller GULT.

## 6. Åmål-benchmark – kvalitativ, inte numerisk

Vid tveksamhet ska varje kommun jämföras med Åmål på följande frågor:

- Känns modulen som en verklig lokal katalog eller bara ett urval?
- Finns rimlig bredd i relation till kommunens storlek?
- Är data aktuell och användbar?
- Saknas någon känd central lokal aktör eller konkret aktuellt innehåll?
- Skulle en lokal invånare uppleva ett tydligt hål jämfört med vad som faktiskt finns i kommunen?

Åmål är referens för **mognadsgrad**, inte för samma antal poster.

## 7. Obligatoriska moduler

Följande moduler ingår i totalstatus:

- Grundkonfiguration / kommunval
- Dagens viktigaste
- Väder
- Vägtrafik
- Kollektivtrafik
- Flyg
- Jobb
- Bostäder
- Evenemang
- Lokala/kommunala nyheter
- Missing People
- Vård & hälsa
- Service & hantverk
- Myndigheter & samhällsservice
- Dagens lunch
- Bio
- Fritid & aktiviteter
- Idrott & föreningar
- Community / Det pratas om

Hero och Matkassen är undantagna.

## 8. Modulprinciper

### Jobb
Platsbanken och andra väsentliga lokala rekryteringskällor ska ge ett trovärdigt aktuellt lokalt utbud. Kända aktuella jobb som saknas är en lucka. Ett litet antal i en liten kommun är inte i sig fel.

### Bostäder
Aktuella objekt från fungerande väsentliga primärkällor ska importeras. BLOCKED privata värdar utan publik aktuell lista blockerar inte automatiskt GRÖNT. Om sekundär eller primär kontroll visar konkreta aktuella objekt som saknas blir modulen GUL tills luckan är löst eller bedömd oväsentlig.

### Evenemang
Kalendern ska ge en trovärdig lokal bild med kommunala, kulturella, förenings-, marknads-, loppis-, sport- och andra publika arrangemang där sådant finns. Ett visst minimiantal är inte ett godkännandekrav.

### Nyheter
Kända centrala lokala nyhetskällor ska vara representerade, innehållet aktuellt, lokalt korrekt och deduplicerat.

### Vård & hälsa
Modulen ska kännas som en användbar lokal vårdkatalog med relevant bredd. Större kommuner kräver större faktisk bredd än små.

### Service & hantverk
Modulen ska vara en användbar lokal katalog, inte bara ett numeriskt minimum. En större kommun med endast ett fåtal företag är GUL om det finns tydligt känt större utbud.

### Dagens lunch
Bedöm verkligt lokalt lunchutbud. 2/2 eller 4/4 kan vara GRÖNT. Ett uppenbart litet urval i en större kommun är GULT.

### Fritid & aktiviteter
Kommunens centrala fritids-, kultur-, frilufts- och aktivitetsutbud ska vara rimligt representerat i proportion till verkligheten.

### Idrott & föreningar
Officiella eller etablerade föreningsregister används som stark kontrollkälla när sådana finns. Tydlig differens mellan register och DinPuls är en konkret lucka. Ett register behöver inte matematiskt bevisas perfekt för att kommunen ska kunna bli GRÖN, men kända större luckor får inte ignoreras.

### Tekniska/nollägesmoduler
Väder, trafik, Missing People, bio och andra nollägesmoduler kan vara GRÖNA med 0 poster när källa/funktion är frisk och nolläget är legitimt.

## 9. BLOCKED-källor

Källstatus BLOCKED är ett evidensfält, inte automatiskt kommunstatus.

BLOCKED bedöms så här:

- **ingen känd aktuell relevant post + liten/sekundär aktör:** blockerar inte automatiskt GRÖNT,
- **konkreta aktuella poster upptäckta utanför DinPuls:** GUL,
- **central/stor aktör vars bortfall sannolikt gör modulen tydligt ofullständig:** GUL,
- **källfel i en aktiv kritisk integration:** GUL eller RÖD beroende på konsekvens.

## 10. Auditmetod

Varje full revision ska börja från aktuell liveversion och aktuell main.

Revisionen ska:

1. kontrollera teknisk funktion,
2. kontrollera aktualitet,
3. jämföra mot definierade och kända väsentliga källor,
4. identifiera konkreta saknade poster/källor,
5. göra proportionalitetsbedömning mot kommunens verkliga storlek och Åmål-benchmark,
6. skilja på faktisk lucka och endast obevisad teoretisk fullständighet,
7. sätta GRÖN, GUL eller RÖD med exakt blockerare där kommunen inte är grön.

Auditmotorn får använda numeriska värden som **varningssignaler**, men aldrig som ensam statuslogik.

## 11. Automatisk audit

`DINPULS-AUDIT-RULES.md` är bindande.

En auditmotor som fortfarande använder fasta gamla miniminivåer som ensam beslutsgrund är inte v4-kompatibel.

Automatiken ska successivt använda coverage-evidence, källstatus, kända blockerare, sanity checks och Åmål-kalibrerad proportionalitetsbedömning.

Om automation och manuell v4-bedömning skiljer sig gäller v4-regeln och den bäst verifierade aktuella evidensen.

## 12. De 21 kommunerna

Samtliga ska bedömas med samma v4-princip:

- Åmål
- Årjäng
- Bengtsfors
- Mellerud
- Arvika
- Grums
- Säffle
- Dals-Ed
- Eda
- Filipstad
- Forshaga
- Färgelanda
- Hagfors
- Hammarö
- Karlstad
- Kil
- Kristinehamn
- Munkfors
- Storfors
- Sunne
- Torsby

## 13. Slutregel

> **GRÖN = en tekniskt fungerande, aktuell och trovärdigt komplett lokal kommunupplevelse på minst Åmål-nivå, utan kända väsentliga luckor.**

> **GUL = kommunen fungerar men har minst en konkret eller starkt underbyggd betydande lucka som påverkar lokal fullständighet.**

> **RÖD = kritisk funktion är trasig, data är väsentligt fel eller stora kända delar av kommunen saknas.**

Teoretisk möjlighet att mer innehåll kan existera får aldrig ensam göra en kommun GUL.

## 14. Rapportering

Slutrapporten ska för varje kommun visa:

- totalstatus,
- viktigaste styrkor,
- konkreta blockerare,
- kända saknade poster/källor,
- tekniska fel,
- moduler som är oproportionerligt tunna,
- varför kommunen når eller inte når Åmål-nivå.

Rapporten ska vara beslutsbar: färgerna ska skilja produktionsklara kommuner från kommuner med verkliga åtgärdsbehov.
