export const CONTRACT_VERSION = "4.0";
export const BILLING = Object.freeze({
  monthly: { label: "Månadsvis", unitPrice: 500, interval: "månad", paymentTerms: "10 dagar netto" },
  annual: { label: "Årsvis i förskott", unitPrice: 5000, interval: "12 månader", paymentTerms: "10 dagar netto" },
  complimentary: { label: "Kostnadsfri", unitPrice: 0, interval: "12 månader", paymentTerms: "Ingen debitering" }
});

export const CONTRACT_TERMS = Object.freeze([
  {
    "title": "1. AVTALETS OMFATTNING",
    "paragraphs": [
      "DinPuls åtar sig att under avtalstiden tillhandahålla de annonsplatser som uttryckligen anges i det individuella avtalet, i angiven kommun och på angivna delar av DinPuls.se. Avtalet omfattar endast de annonsplatser, den avtalsperiod och de villkor som framgår av avtalet.",
      "Den avtalade annonsplatsen är exklusivt reserverad för företaget under avtalstiden och upplåts inte samtidigt till ett annat företag.",
      "Om inget annat uttryckligen anges ingår inte exklusivitet inom bransch, garanterad placering i viss ordningsföljd, ett visst antal exponeringar, klick, kundkontakter eller andra resultat.",
      "Mindre tekniska eller redaktionella förändringar av webbplatsens struktur, modulnamn eller layout får göras under avtalstiden under förutsättning att företagets annonsplats behåller i huvudsak motsvarande synlighet och funktion."
    ]
  },
  {
    "title": "2. ANNONSMATERIAL OCH ANSVAR",
    "paragraphs": [
      "Företaget ansvarar för att allt annonsmaterial som lämnas till DinPuls, inklusive bilder, texter, länkar, logotyper, varumärken och övrigt innehåll, är korrekt och får användas för annonsering. Företaget ansvarar även för att materialet inte gör intrång i tredje mans rättigheter eller strider mot lag, myndighetsbeslut eller god marknadsföringssed.",
      "DinPuls har rätt att neka, pausa eller begära ändring av annonsmaterial som bedöms vara olagligt, vilseledande, diskriminerande, kränkande, tekniskt skadligt eller på annat sätt olämpligt för publicering på DinPuls.se. DinPuls ska i sådant fall informera företaget och, när det är möjligt, ge företaget möjlighet att lämna ersättningsmaterial.",
      "Annonser för pornografiskt innehåll, tobaks- eller nikotinprodukter samt spel om pengar accepteras inte.",
      "Politisk annonsering kan tillåtas enligt de riktlinjer DinPuls tillämpar vid tidpunkten för publicering. Sådan annonsering ska tydligt kunna särskiljas från DinPuls redaktionella och samhällsinformerande innehåll.",
      "Företaget ansvarar för att lämna material i ett format och med en kvalitet som fungerar för den avtalade annonsplatsen. Om material saknas, är felaktigt eller inte kan publiceras på grund av förhållanden som företaget ansvarar för, påverkar detta inte avtalstidens längd eller företagets betalningsskyldighet.",
      "DinPuls ansvarar för att publicera godkänt material på avtalad annonsplats och för att materialet visas på ett tekniskt fungerande sätt inom ramen för DinPuls normala drift.",
      "Företaget får byta annonsmaterial inom ramen för de bannerbyten som följer av punkt 3."
    ]
  },
  {
    "title": "3. BANNERBYTEN OCH SCHEMALÄGGNING",
    "paragraphs": [
      "Företaget har rätt att byta annonsmaterial upp till fyra gånger per påbörjad 30-dagarsperiod och per avtalad annonsplats.",
      "Den första 30-dagarsperioden börjar löpa från det datum avtalet börjar gälla och därefter följer nya 30-dagarsperioder löpande under hela avtalstiden.",
      "Om avtalet omfattar flera annonsplatser gäller fyra bannerbyten per 30-dagarsperiod för varje enskild annonsplats.",
      "Exempel: Två annonsplatser ger möjlighet till totalt upp till åtta bannerbyten per 30-dagarsperiod, men högst fyra byten på respektive annonsplats.",
      "Företaget kan i företagsportalen ladda upp och schemalägga kommande annonsmaterial för publicering på ett framtida datum och klockslag.",
      "När ett nytt material börjar visas ersätter det material som tidigare varit aktivt på samma annonsplats.",
      "Ett bannerbyte räknas när ett nytt annonsmaterial faktiskt publiceras och ersätter ett tidigare material på den aktuella annonsplatsen.",
      "Enbart uppladdning eller schemaläggning av material som ännu inte publicerats räknas inte som ett genomfört byte.",
      "Oanvända bannerbyten sparas inte till nästa 30-dagarsperiod. När en ny period börjar får respektive annonsplats åter möjlighet till fyra bannerbyten.",
      "Om företaget behöver fler än fyra byten på en annonsplats under samma 30-dagarsperiod kan ytterligare byten erbjudas enligt separat överenskommelse eller DinPuls vid var tid gällande prislista.",
      "Företaget ansvarar för att uppladdat material, länkar och schemalagda publiceringstider är korrekta.",
      "DinPuls ansvarar för att den tekniska schemaläggningsfunktionen fungerar inom ramen för normal drift."
    ]
  },
  {
    "title": "4. PRIS OCH BETALNING",
    "paragraphs": [
      "Ordinarie betalningsalternativ är:",
      "A) Månadsvis: 500 kronor per annonsplats och månad exklusive moms.",
      "B) Årsvis i förskott: 5 000 kronor per annonsplats exklusive moms för en avtalsperiod om 12 månader.",
      "C) Kostnadsfri: endast när en annonsplats uttryckligen upplåtits kostnadsfritt.",
      "Månadsbetalning under tolv månader motsvarar: 6 000 kr per plats.",
      "Årsbetalning innebär således ett lägre totalpris.",
      "Det individuella avtalet ska visa:",
      "- vald betalningsform - pris per plats - antal platser - total debitering - momsstatus - 10 dagar netto",
      "Betalningsvillkor: 10 dagar netto om inget annat uttryckligen överenskommits.",
      "Vid försenad betalning har DinPuls rätt att debitera dröjsmålsränta enligt räntelagen samt tillämpliga lagstadgade avgifter för påminnelse och inkasso.",
      "Om betalning trots påminnelse inte sker har DinPuls rätt att tillfälligt pausa företagets annonsering tills den förfallna betalningen har reglerats.",
      "Sådan paus förlänger inte avtalsperioden och befriar inte företaget från betalningsskyldighet.",
      "En kostnadsfri annonsplats ska uttryckligen anges som kostnadsfri i avtalet.",
      "Övriga avtalsvillkor gäller även för kostnadsfria platser om inget annat uttryckligen anges.",
      "Pris får inte ändras under pågående avtalsperiod utan båda parters godkännande.",
      "Invändningar mot faktura ska meddelas DinPuls utan oskäligt dröjsmål.",
      "Den del av fakturan som inte är tvistig ska betalas enligt ordinarie betalningsvillkor."
    ]
  },
  {
    "title": "5. STATISTIK OCH RESULTAT",
    "paragraphs": [
      "DinPuls kan tillhandahålla löpande statistik för företagets annonsplatser, exempelvis antal visningar och klick, i företagsportalen eller på annat sätt som DinPuls tillhandahåller.",
      "Statistiken är avsedd som uppföljning av annonsens exponering och användarnas interaktion med annonsmaterialet.",
      "DinPuls ska sträva efter att statistiken är tekniskt korrekt och konsekvent, men mindre avvikelser kan förekomma till följd av exempelvis webbläsarinställningar, annonsblockering, automatiserad trafik, tekniska begränsningar eller andra förhållanden utanför DinPuls kontroll.",
      "DinPuls garanterar inte ett visst antal visningar, klick, kundkontakter, förfrågningar, försäljningar eller annat affärsresultat.",
      "Företagets betalningsskyldighet är därför inte beroende av att ett visst resultat uppnås, om inget annat uttryckligen anges i det individuella avtalet.",
      "DinPuls har rätt att filtrera bort eller korrigera uppenbart felaktig, automatiserad eller manipulerad trafik från statistiken för att ge en så rättvisande bild som möjligt.",
      "Statistik som visas för företaget avser endast företagets egna annonsplatser och ska inte ge tillgång till andra annonsörers konfidentiella uppgifter."
    ]
  },
  {
    "title": "6. AVTALSTID, BINDNINGSTID OCH FÖRNYELSE",
    "paragraphs": [
      "Avtalet gäller under den avtalsperiod som anges i det individuella avtalet.",
      "Om inget annat anges är avtalsperioden 12 månader från och med avtalets startdatum.",
      "Avtalsperioden är bindande för båda parter.",
      "DinPuls åtar sig att under perioden driva och utveckla tjänsten samt arbeta för att skapa trafik och lokal användning av DinPuls.se.",
      "Företaget deltar i satsningen genom att bidra med relevant lokalt annonsinnehåll, exempelvis erbjudanden, information, kampanjer eller annat material som företaget väljer att publicera inom ramen för avtalet.",
      "Parternas gemensamma utgångspunkt är att avtalsperioden om 12 månader ska ge DinPuls och de medverkande företagen tillräcklig tid att bygga användning, trafik och lokal relevans tillsammans.",
      "Företaget har rätt att begära att annonseringen avslutas före avtalsperiodens slut.",
      "Ett sådant avslut befriar dock inte företaget från betalningsskyldigheten för återstående del av den bindande avtalsperioden.",
      "Om företaget betalar månadsvis fortsätter faktureringen enligt avtalet fram till avtalsperiodens slut även om annonseringen har avslutats på företagets begäran.",
      "Om företaget har betalat årsvis i förskott återbetalas inte den del av årsavgiften som avser återstående avtalsperiod vid ett sådant frivilligt förtida avslut.",
      "Avtalet förlängs inte automatiskt.",
      "Inför avtalsperiodens slut kan DinPuls och företaget gemensamt komma överens om en ny avtalsperiod och de villkor som då ska gälla.",
      "Om en ny överenskommelse inte träffas upphör avtalet vid avtalsperiodens slut utan krav på särskild uppsägning.",
      "Förlängning, nytt pris, ändrat antal annonsplatser eller andra ändrade villkor ska godkännas av båda parter och dokumenteras i ett nytt avtal eller en ny skriftlig överenskommelse."
    ]
  },
  {
    "title": "7. ÄNDRINGAR EFTER SIGNERING",
    "paragraphs": [
      "När avtalet har undertecknats av båda parter är avtalet bindande och får inte ändras ensidigt av någon av parterna.",
      "Ändringar som påverkar pris, antal annonsplatser, avtalsperiod, betalningsform, exklusivitet eller andra väsentliga villkor ska godkännas av både företaget och DinPuls och dokumenteras skriftligen.",
      "Mindre administrativa ändringar, såsom uppdatering av kontaktperson, telefonnummer, fakturaadress eller andra kontaktuppgifter, får göras utan att ett nytt avtal behöver tecknas, under förutsättning att ändringen inte påverkar avtalets ekonomiska eller materiella innehåll.",
      "Byte av annonsmaterial inom ramen för avtalet och de bannerbyten som ingår enligt punkt 3 betraktas inte som en ändring av avtalet.",
      "Om parterna kommer överens om en väsentlig förändring kan detta dokumenteras genom ett tilläggsavtal eller genom att ett nytt avtal upprättas.",
      "Den ursprungliga signerade avtalskopian ska alltid bevaras oförändrad."
    ]
  },
  {
    "title": "8. ELEKTRONISK UNDERSKRIFT OCH AVTALSKOPIA",
    "paragraphs": [
      "Avtalet undertecknas elektroniskt av både företaget och DinPuls.",
      "Genom underskriften bekräftar respektive part att den har tagit del av avtalets innehåll och godkänner samtliga villkor i avtalet.",
      "Den person som undertecknar avtalet för företagets räkning ansvarar för att ha rätt att företräda företaget och ingå avtalet.",
      "Elektronisk underskrift får ske genom den signeringsfunktion som DinPuls tillhandahåller, exempelvis genom underskrift med finger eller penna på telefon, surfplatta eller annan kompatibel enhet.",
      "Precis ovanför kundens signaturfält ska följande text visas:",
      "\"Genom att skriva under bekräftar jag att jag har rätt att företräda företaget och att jag godkänner avtalet och dess villkor.\"",
      "Spara:",
      "- kundens namn - kundens befattning/roll - kundens signatur - DinPuls företrädares namn - DinPuls företrädares roll - DinPuls signatur",
      "Avtalet blir bindande när både företaget och DinPuls har undertecknat det.",
      "Efter att båda underskrifterna registrerats ska den slutliga avtalsversionen låsas så att innehållet inte kan ändras i efterhand.",
      "Den signerade avtalskopian ska innehålla de uppgifter och villkor som gällde vid signeringstillfället, inklusive avtalsnummer, företag, annonsplatser, avtalsperiod, pris, betalningsform och parternas underskrifter.",
      "DinPuls ska bevara den signerade avtalskopian under avtalstiden och därefter under den tid som krävs för administration, bokföring, rättsliga anspråk eller andra berättigade ändamål.",
      "Efter signering ska företaget få tillgång till en kopia av det signerade avtalet elektroniskt, exempelvis genom e-post och/eller företagets konto hos DinPuls.",
      "DinPuls ska ha tillgång till samma signerade avtalskopia i administrationssystemet.",
      "Om en teknisk störning inträffar under själva signeringen och det inte går att fastställa att båda parternas underskrifter registrerats korrekt ska avtalet inte betraktas som färdigsignerat.",
      "Signeringen ska då genomföras på nytt.",
      "En signerad avtalskopia får inte ersättas eller ändras i efterhand.",
      "Eventuella senare ändringar ska dokumenteras separat enligt punkt 7."
    ]
  },
  {
    "title": "9. KONTAKT OCH PERSONUPPGIFTER",
    "paragraphs": [
      "Företaget ansvarar för att de kontakt- och företagsuppgifter som lämnas till DinPuls är korrekta och aktuella under hela avtalsperioden.",
      "Företaget ska meddela DinPuls om uppgifter som kontaktperson, telefonnummer, e-postadress, fakturaadress eller andra relevanta uppgifter förändras.",
      "DinPuls behandlar de personuppgifter som är nödvändiga för att administrera avtalet, hantera kontakt med företaget, tillhandahålla företagskonto och annonsfunktioner, hantera fakturering, signering, support och annan avtalsrelaterad administration.",
      "Uppgifterna får även behandlas i den utsträckning som krävs för att DinPuls ska kunna uppfylla rättsliga skyldigheter, hantera eventuella rättsliga anspråk eller skydda sina berättigade intressen.",
      "DinPuls ska vidta rimliga tekniska och organisatoriska åtgärder för att skydda personuppgifter och annan avtalsinformation mot obehörig åtkomst, förlust, ändring eller otillåten spridning.",
      "Personuppgifter ska inte lämnas ut till tredje part annat än när det är nödvändigt för att tillhandahålla tjänsten, uppfylla avtalet, följa lag eller myndighetsbeslut, eller när annat lagligt stöd finns.",
      "När externa tjänsteleverantörer används, exempelvis för e-post, lagring, drift, fakturering eller annan teknisk administration, får nödvändiga uppgifter behandlas av dessa leverantörer för DinPuls räkning.",
      "Mer information om DinPuls behandling av personuppgifter kan lämnas i en separat integritetsinformation eller integritetspolicy."
    ]
  },
  {
    "title": "10. AVTALSHANDLINGEN",
    "paragraphs": [
      "Det bindande avtalet består av det individuella annonsavtalet med tillhörande avtalsvillkor i den version som gällde vid signeringstillfället.",
      "Avtalet ska bland annat identifiera företaget, avtalsnummer, avtalade annonsplatser, kommun, avtalsperiod, betalningsform, pris samt andra individuellt överenskomna villkor.",
      "De avtalsvillkor som visas och godkänns i samband med signeringen utgör en del av avtalet.",
      "Den signerade och låsta avtalskopian ska utgöra bevis för vilka villkor parterna har godkänt.",
      "Om uppgifter i annan kommunikation, exempelvis e-post, muntliga uppgifter, försäljningsmaterial eller information på DinPuls.se, skulle avvika från den signerade avtalskopian gäller den signerade avtalskopian, om inte parterna senare skriftligen har kommit överens om annat.",
      "Särskilda villkor som uttryckligen anges i det individuella avtalet gäller framför generella avtalsvillkor i den utsträckning villkoren skulle strida mot varandra.",
      "Eventuella tillägg eller ändringar efter signering ska hanteras enligt punkt 7 och ska inte förändra eller ersätta den ursprungliga signerade avtalskopian.",
      "Avtalet upprättas elektroniskt.",
      "Båda parter ska ha möjlighet att få tillgång till och spara en kopia av den signerade avtalsversionen."
    ]
  },
  {
    "title": "11. DRIFTSTÖRNINGAR OCH ANSVAR",
    "paragraphs": [
      "DinPuls ska arbeta för att DinPuls.se och företagets avtalade annonsplatser är tillgängliga och tekniskt fungerande under avtalsperioden.",
      "Tillfälliga driftstörningar, tekniskt underhåll, uppdateringar, fel hos externa leverantörer, internetstörningar eller andra kortare avbrott innebär inte i sig att DinPuls har brutit mot avtalet.",
      "DinPuls ska vid väsentliga tekniska störningar som påverkar företagets annonsering vidta rimliga åtgärder för att återställa funktionen så snart som möjligt.",
      "En störning ska bedömas som väsentlig med hänsyn till bland annat störningens längd, omfattning, vilken annonsplats som berörs och i vilken grad företagets annonsering faktiskt har påverkats.",
      "Enstaka eller kortvariga avbrott ska normalt inte betraktas som väsentliga.",
      "Om en avtalad annonsplats, på grund av ett fel som DinPuls ansvarar för, är otillgänglig under en sammanhängande eller sammantaget så betydande tid att företagets annonsering i väsentlig grad har påverkats, ska DinPuls i första hand erbjuda en skälig förlängning av annonseringstiden eller annan motsvarande kompensation.",
      "DinPuls ansvarar inte för indirekt skada, utebliven vinst, förlorad försäljning, förlorade kundkontakter eller annan följdskada som uppstår till följd av driftstörning, tekniskt fel eller tillfällig otillgänglighet, såvida annat följer av tvingande lag.",
      "DinPuls ansvarar inte för störningar eller fel som beror på företagets eget material, företagets system, externa webbplatser som annonsen länkar till eller andra förhållanden utanför DinPuls rimliga kontroll.",
      "Företaget ska meddela DinPuls inom skälig tid om det upptäcker ett fel som väsentligt påverkar den avtalade annonseringen så att DinPuls får möjlighet att undersöka och åtgärda felet."
    ]
  },
  {
    "title": "12. FORCE MAJEURE",
    "paragraphs": [
      "Part är befriad från ansvar för underlåtenhet att fullgöra en skyldighet enligt avtalet i den utsträckning underlåtenheten beror på en omständighet utanför partens rimliga kontroll och som parten inte skäligen kunde ha förutsett eller undvikit.",
      "Sådana omständigheter kan exempelvis vara krig, krigsliknande händelser, terrorism, omfattande samhällsstörningar, naturkatastrofer, brand, översvämning, epidemi eller pandemi, myndighetsbeslut, arbetskonflikt, större störningar i el-, tele- eller internetinfrastruktur, cyberangrepp eller allvarliga driftstörningar hos kritiska externa leverantörer.",
      "Den part som påverkas ska, när det är praktiskt möjligt, informera den andra parten om omständigheten och dess förväntade påverkan på avtalet.",
      "Part ska vidta skäliga åtgärder för att begränsa konsekvenserna och återuppta fullgörandet av sina skyldigheter så snart det rimligen är möjligt.",
      "Om force majeure-situationen endast tillfälligt påverkar annonseringen ska avtalet i övrigt fortsätta att gälla.",
      "Om situationen medför ett långvarigt och väsentligt hinder för fullgörandet ska parterna försöka hitta en skälig lösning, exempelvis förlängning av avtalsperioden, tillfällig paus eller annan motsvarande justering.",
      "Force majeure medför inte automatiskt rätt till skadestånd eller återbetalning."
    ]
  },
  {
    "title": "13. AVTALSBROTT OCH HÄVNING",
    "paragraphs": [
      "Om en part väsentligen bryter mot sina skyldigheter enligt avtalet har den andra parten rätt att skriftligen begära rättelse.",
      "Den felande parten ska ges skälig möjlighet att rätta avtalsbrottet, om rättelse är möjlig.",
      "Om ett väsentligt avtalsbrott inte rättas inom skälig tid efter begäran om rättelse har den andra parten rätt att häva avtalet med omedelbar verkan.",
      "DinPuls har rätt att omedelbart pausa annonsering som strider mot lag, myndighetsbeslut eller de regler om annonsmaterial som följer av detta avtal.",
      "Om företaget efter uppmaning inte ersätter materialet med godtagbart material får DinPuls, vid ett väsentligt eller återkommande avtalsbrott, häva avtalet.",
      "Upprepad eller väsentlig utebliven betalning utgör ett väsentligt avtalsbrott.",
      "DinPuls har i sådant fall rätt att pausa annonseringen och, om betalning fortfarande inte sker efter påminnelse och skälig möjlighet till rättelse, häva avtalet och kräva betalning av förfallna samt enligt avtalet återstående belopp i den utsträckning detta är rättsligt tillåtet.",
      "Om DinPuls väsentligen och varaktigt underlåter att tillhandahålla de avtalade annonsplatserna och inte rättar bristen inom skälig tid efter att företaget har påtalat den, har företaget motsvarande rätt att häva avtalet.",
      "Vid sådan hävning ansvarar företaget inte för betalning av den del av avtalsperioden som infaller efter att avtalet har upphört och eventuell förskottsbetalning för sådan återstående period ska återbetalas i skälig omfattning.",
      "Ett företags frivilliga beslut att sluta annonsera eller avsluta sin verksamhet på DinPuls utgör inte i sig grund för att häva avtalet eller upphöra med betalningsskyldigheten enligt punkt 6.",
      "Hävning påverkar inte rättigheter eller betalningskrav som redan har uppkommit före den dag avtalet upphör."
    ]
  },
  {
    "title": "14. TILLÄMPLIG LAG OCH TVIST",
    "paragraphs": [
      "Avtalet ska tolkas och tillämpas enligt svensk rätt.",
      "Om en tvist uppstår med anledning av avtalet ska parterna i första hand försöka lösa tvisten genom dialog och förhandling.",
      "Om parterna inte kan nå en överenskommelse ska tvisten avgöras av svensk allmän domstol."
    ]
  }
]);

export function calculateContractPrice(cadence, placementCount) {
  const billing = BILLING[cadence];
  if (!billing || !Number.isInteger(placementCount) || placementCount < 1 || placementCount > 20) throw new Error("Ogiltig betalningsform eller antal platser.");
  return { cadence, unitPrice: billing.unitPrice, monthlyTotal: cadence === "monthly" ? billing.unitPrice * placementCount : 0, annualTotal: cadence === "monthly" ? billing.unitPrice * placementCount * 12 : billing.unitPrice * placementCount, invoiceTotal: billing.unitPrice * placementCount, label: billing.label, interval: billing.interval, paymentTerms: billing.paymentTerms, vat: "exklusive moms" };
}
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
