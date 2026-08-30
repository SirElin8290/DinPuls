#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "data/authorities.json"
data = json.loads(path.read_text(encoding="utf-8"))
data["version"] = "0.22.0"
data["checkedAt"] = "2026-08-30"

data["municipalServices"] = [
    {"id":"socialtjanst","name":"Socialtjänst & familjestöd","group":"Familj & socialt stöd","icon":"heart-handshake","description":"Stöd för barn, familjer, missbruk, våld i nära relation och andra svåra livssituationer.","terms":"socialen socialtjänst orosanmälan barn familj missbruk våld skydd stöd"},
    {"id":"ekonomiskt-bistand","name":"Ekonomiskt bistånd","group":"Pengar, bidrag & pension","icon":"hand-coins","description":"Ansökan och information om försörjningsstöd hos kommunen.","terms":"försörjningsstöd socialbidrag ekonomiskt bistånd pengar hyra mat"},
    {"id":"budget-skuld","name":"Budget- & skuldrådgivning","group":"Brott, rättigheter & skulder","icon":"scale","description":"Kostnadsfri kommunal rådgivning om ekonomi, skulder och skuldsanering.","terms":"skuld skulder budget skuldsanering kronofogden ekonomi rådgivning"},
    {"id":"aldreomsorg","name":"Äldreomsorg & hemtjänst","group":"Äldre & funktionsstöd","icon":"heart-pulse","description":"Hemtjänst, särskilt boende, trygghetslarm, anhörigstöd och annan hjälp för äldre.","terms":"äldre äldreomsorg hemtjänst särskilt boende trygghetslarm senior anhörigstöd bistånd"},
    {"id":"lss","name":"LSS & funktionsstöd","group":"Äldre & funktionsstöd","icon":"accessibility","description":"Stöd och insatser för personer med funktionsnedsättning, inklusive LSS och personlig assistans.","terms":"lss funktionsnedsättning funktionsstöd personlig assistans ledsagare daglig verksamhet boendestöd"},
    {"id":"barn-skola","name":"Förskola, skola & utbildning","group":"Barn, skola & utbildning","icon":"school","description":"Förskola, grundskola, gymnasium, skolskjuts, vuxenutbildning och stöd i skolan.","terms":"förskola skola grundskola gymnasium skolskjuts vuxenutbildning komvux elev barn utbildning"},
    {"id":"fardtjanst-bostadsanpassning","name":"Färdtjänst & bostadsanpassning","group":"Fordon, körkort & trafik","icon":"bus-front","description":"Ansökan om färdtjänst, riksfärdtjänst och bostadsanpassningsbidrag där kommunen ansvarar.","terms":"färdtjänst riksfärdtjänst bostadsanpassning bostadsanpassningsbidrag resa funktionsnedsättning"},
    {"id":"overformyndare","name":"Överförmyndare & god man","group":"Familj & socialt stöd","icon":"user-round-check","description":"Information om god man, förvaltare och förmyndarskap.","terms":"god man förvaltare överförmyndare förmyndare fullmakt"},
    {"id":"bygglov","name":"Bygglov & miljö","group":"Boende, mark & tillstånd","icon":"building-2","description":"Bygglov, rivlov, marklov, enskilt avlopp, miljöfrågor och lokala tillstånd.","terms":"bygglov avlopp miljö tillstånd tomt bygga rivlov marklov"},
    {"id":"va-avfall","name":"Vatten, avlopp & avfall","group":"Boende, mark & tillstånd","icon":"droplets","description":"Kommunalt vatten och avlopp, avfall, återvinning, slamtömning och driftfrågor.","terms":"vatten avlopp va avfall sopor återvinning återvinningscentral slamtömning renhållning"},
    {"id":"raddning-brandskydd","name":"Räddningstjänst & brandskydd","group":"Trygghet & beredskap","icon":"flame","description":"Brandskydd, sotning, eldning, räddningstjänst och förebyggande säkerhetsinformation.","terms":"räddningstjänst brand brandskydd sotning eldning brandfarligt säkerhet"},
    {"id":"vald-nara","name":"Våld i nära relation & skydd","group":"Familj & socialt stöd","icon":"shield-alert","description":"Kommunalt stöd vid våld, hot, hedersrelaterat våld och behov av skydd.","terms":"våld nära relation hot skydd kvinnojour heder hedersvåld utsatt socialjour"},
    {"id":"konsument","name":"Konsumentvägledning","group":"Konsument & avtal","icon":"shopping-bag","description":"Kommunal vägledning om köp, avtal, reklamationer och konsumenttvister där tjänsten finns.","terms":"konsument reklamation köp avtal företag garanti ångerrätt tvist arn"},
    {"id":"foretag","name":"Företagsservice & tillstånd","group":"Företag & arbetsliv","icon":"briefcase-business","description":"Kommunal företagsservice, etablering, serveringstillstånd och andra lokala företagsärenden.","terms":"företag näringsliv starta företag etablering serveringstillstånd tillstånd företagare"},
    {"id":"val-demokrati","name":"Val, demokrati & politiska beslut","group":"Demokrati & val","icon":"vote","description":"Kommunfullmäktige, nämnder, handlingar, överklaganden, lokala valfrågor och demokratiska ingångar.","terms":"val rösta demokrati kommunfullmäktige nämnd politiker protokoll handling överklaga"},
    {"id":"kontaktcenter","name":"Kommunens kontaktcenter & e-tjänster","group":"Kommunal service","icon":"landmark","description":"Kommunens samlade ingång för frågor, blanketter, felanmälan och e-tjänster.","terms":"kommun kontakt telefon e-tjänst blankett felanmälan servicecenter"},
]

for item in data["nationalServices"]:
    if item.get("id") == "migrationsverket": item["group"] = "Skatt, flytt & identitet"
    if item.get("id") == "hallakonsument": item["group"] = "Konsument & avtal"

additions = [
    {"id":"arn","name":"Allmänna reklamationsnämnden (ARN)","group":"Konsument & avtal","type":"Statlig myndighet","icon":"scale","description":"Prövar tvister mellan konsumenter och företag och lämnar rekommendationer.","terms":"arn tvist företag konsument reklamation köp avtal resa hantverk","url":"https://www.arn.se/"},
    {"id":"konsumentverket","name":"Konsumentverket","group":"Konsument & avtal","type":"Statlig myndighet","icon":"badge-check","description":"Konsumentskydd, anmälningar om marknadsföring, avtalsvillkor och produktsäkerhet.","terms":"konsumentverket anmäla företag reklam marknadsföring avtalsvillkor produktsäkerhet","url":"https://www.konsumentverket.se/"},
    {"id":"imy","name":"Integritetsskyddsmyndigheten (IMY)","group":"Brott, rättigheter & skulder","type":"Statlig myndighet","icon":"shield-check","description":"Personuppgifter, GDPR, kamerabevakning och klagomål om integritetsfrågor.","terms":"imy gdpr personuppgifter integritet kamerabevakning klagomål register","url":"https://www.imy.se/","selfServiceUrl":"https://e-tjanster.imy.se/"},
    {"id":"arbetsmiljoverket","name":"Arbetsmiljöverket","group":"Företag & arbetsliv","type":"Statlig myndighet","icon":"hard-hat","description":"Arbetsmiljö, anmälan av risker, regler för arbetsgivare och arbetstagare.","terms":"arbetsmiljö arbetsgivare arbetstagare skyddsombud olycka risk arbetsplats","url":"https://www.av.se/"},
    {"id":"bolagsverket","name":"Bolagsverket","group":"Företag & arbetsliv","type":"Statlig myndighet","icon":"building","description":"Registrera, ändra och avveckla företag och föreningar samt företagsuppgifter.","terms":"bolagsverket registrera företag aktiebolag styrelse förening verklig huvudman","url":"https://bolagsverket.se/"},
    {"id":"verksamt","name":"Verksamt.se","group":"Företag & arbetsliv","type":"Myndighetsgemensam tjänst","icon":"briefcase-business","description":"Samlad myndighetsservice för att starta, driva, utveckla och avveckla företag.","terms":"verksamt starta företag f-skatt affärsplan tillstånd företagare arbetsgivare","url":"https://verksamt.se/"},
    {"id":"valmyndigheten","name":"Valmyndigheten","group":"Demokrati & val","type":"Statlig myndighet","icon":"vote","description":"Rösträtt, röstkort, röstning, valresultat och information om svenska val.","terms":"val rösta röstkort rösträtt vallokal förtidsrösta valresultat","url":"https://www.val.se/"},
]
by_id = {item["id"]: item for item in data["nationalServices"]}
for item in additions: by_id[item["id"]] = item
data["nationalServices"] = list(by_id.values())

service_urls = {
    "Åmål": {"socialtjanst":"https://amal.se/omsorg-och-stod","ekonomiskt-bistand":"https://amal.se/omsorg-och-stod/ekonomi-for-omsorg-och-stod","budget-skuld":"https://amal.se/omsorg-och-stod/ekonomi-for-omsorg-och-stod","aldreomsorg":"https://amal.se/omsorg-och-stod","lss":"https://amal.se/omsorg-och-stod","barn-skola":"https://amal.se/barn-och-utbildning","fardtjanst-bostadsanpassning":"https://amal.se/bygga-bo-och-leva-hallbart","overformyndare":"https://amal.se/omsorg-och-stod","bygglov":"https://amal.se/bygga-bo-och-leva-hallbart","va-avfall":"https://amal.se/bygga-bo-och-leva-hallbart","raddning-brandskydd":"https://amal.se/bygga-bo-och-leva-hallbart","vald-nara":"https://amal.se/omsorg-och-stod"},
    "Säffle": {"socialtjanst":"https://saffle.se/omsorg-och-stod.html","ekonomiskt-bistand":"https://saffle.se/omsorg-och-stod/ekonomiskt-stod.html","budget-skuld":"https://saffle.se/omsorg-och-stod/ekonomiskt-stod.html","aldreomsorg":"https://saffle.se/omsorg-och-stod.html","lss":"https://saffle.se/omsorg-och-stod.html","vald-nara":"https://saffle.se/omsorg-och-stod.html","barn-skola":"https://saffle.se/barn-och-utbildning.html"},
    "Bengtsfors": {"socialtjanst":"https://www.bengtsfors.se/stod-i-livet","ekonomiskt-bistand":"https://www.bengtsfors.se/stod-i-livet/ekonomiskt-stod","budget-skuld":"https://www.bengtsfors.se/stod-i-livet/ekonomiskt-stod","aldreomsorg":"https://www.bengtsfors.se/stod-i-livet","lss":"https://www.bengtsfors.se/stod-i-livet","vald-nara":"https://www.bengtsfors.se/stod-i-livet","bygglov":"https://www.bengtsfors.se/bygga-bo-och-miljo","va-avfall":"https://www.bengtsfors.se/bygga-bo-och-miljo","raddning-brandskydd":"https://www.bengtsfors.se/bygga-bo-och-miljo"},
    "Mellerud": {"socialtjanst":"https://mellerud.se/omsorg-och-stod/","ekonomiskt-bistand":"https://mellerud.se/omsorg-och-stod/ekonomi-och-pengar/ekonomiskt-bistand-forsorjningsstod/","budget-skuld":"https://mellerud.se/omsorg-och-stod/ekonomi-och-pengar/","aldreomsorg":"https://mellerud.se/omsorg-och-stod/aldre/ansoka-om-vard-och-omsorg/bistandsenheten/","lss":"https://mellerud.se/omsorg-och-stod/","vald-nara":"https://mellerud.se/omsorg-och-stod/","bygglov":"https://mellerud.se/bygga-bo-och-miljo/","va-avfall":"https://mellerud.se/bygga-bo-och-miljo/","raddning-brandskydd":"https://mellerud.se/bygga-bo-och-miljo/"},
    "Arvika": {"bygglov":"https://www.arvika.se/byggaboochmiljo.2853.html","va-avfall":"https://www.arvika.se/byggaboochmiljo.2853.html","raddning-brandskydd":"https://www.arvika.se/byggaboochmiljo.2853.html"},
    "Grums": {"ekonomiskt-bistand":"https://www.grums.se/stodomsorg/ekonomisktstod.5567.html","budget-skuld":"https://www.grums.se/stodomsorg/ekonomisktstod/budgetochskuldradgivning.5487.html","aldreomsorg":"https://www.grums.se/stodomsorg/ansokomhjalpochstod/kontaktabistandshandlaggare.5628.html","lss":"https://www.grums.se/stodomsorg/ansokomhjalpochstod/kontaktabistandshandlaggare.5628.html"},
    "Sunne": {"budget-skuld":"https://www.sunne.se/kommun/stod-och-omsorg/ekonomi-ekonomiskt-bistand/budget--och-skuldradgivning/"},
}
for municipality, urls in service_urls.items():
    if municipality in data["municipalities"]: data["municipalities"][municipality]["serviceUrls"] = urls
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

js = ROOT / "myndigheter-page.js"
text = js.read_text(encoding="utf-8")
start = text.index("function municipalSearchUrl(service) {")
end = text.index("\n\nfunction renderAuthorities()", start)
replacement = '''function municipalServiceTarget(service) {
  const municipality = authorityData.municipalities[authorityMunicipality];
  const directUrl = municipality?.serviceUrls?.[service.id];
  return { url: directUrl || municipality?.website || "", direct: Boolean(directUrl) };
}

function authorityCard(item, local = false) {
  const localTarget = local ? municipalServiceTarget(item) : null;
  const url = local ? localTarget.url : item.url;
  const type = local ? "Kommunal verksamhet" : item.type;
  const label = local ? (localTarget.direct ? "Öppna rätt sida" : "Öppna kommunens webbplats") : "Öppna officiell webbplats";
  const actions = [
    `<a href="${escapeAuthority(safeAuthorityUrl(url))}" target="_blank" rel="noopener noreferrer">${label}<i data-lucide="external-link"></i></a>`
  ];
  if (!local && item.selfServiceUrl) actions.push(`<a href="${escapeAuthority(safeAuthorityUrl(item.selfServiceUrl))}" target="_blank" rel="noopener noreferrer">E-tjänster / Mina sidor</a>`);
  if (!local && item.contactUrl) actions.push(`<a href="${escapeAuthority(safeAuthorityUrl(item.contactUrl))}" target="_blank" rel="noopener noreferrer">Kontakta</a>`);
  return `<article class="authority-card"><div class="authority-card-top"><span class="authority-card-icon"><i data-lucide="${escapeAuthority(safeAuthorityIcon(item.icon))}"></i></span><span class="authority-owner">${escapeAuthority(type)}</span></div><em>${escapeAuthority(item.group)}</em><h3>${escapeAuthority(item.name)}</h3><p>${escapeAuthority(item.description)}</p><div class="authority-actions">${actions.join("")}</div></article>`;
}'''
js.write_text(text[:start] + replacement + text[end:], encoding="utf-8")

page = ROOT / "myndigheter.html"
html = page.read_text(encoding="utf-8")
html = html.replace("Exempel: VAB, socialen, skuld, flytta eller körkort", "Exempel: VAB, hemtjänst, LSS, bygglov, skuld, företag eller rösta")
html = html.replace("pension, jobb, socialen, skatt, körkort eller skuld", "pension, hemtjänst, LSS, företag, bygglov, skatt eller skuld")
html = html.replace("Guiden senast strukturellt granskad 8 augusti 2026.", "Guiden senast strukturellt granskad 30 augusti 2026.")
html = html.replace("myndigheter-page.js?version=0.24.6", "myndigheter-page.js?version=0.24.7")
page.write_text(html, encoding="utf-8")

(ROOT / "scripts/test_authorities.py").write_text('''#!/usr/bin/env python3
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
data = json.loads((root / "data/authorities.json").read_text(encoding="utf-8"))
municipalities = json.loads((root / "data/municipalities.json").read_text(encoding="utf-8"))
assert set(data["municipalities"]) == {item["name"] for item in municipalities["municipalities"]}
local, national = data["municipalServices"], data["nationalServices"]
assert len({x["id"] for x in local}) == len(local) and len({x["id"] for x in national}) == len(national)
required_local = {"socialtjanst","ekonomiskt-bistand","budget-skuld","aldreomsorg","lss","barn-skola","fardtjanst-bostadsanpassning","overformyndare","bygglov","va-avfall","raddning-brandskydd","vald-nara","konsument","foretag","val-demokrati","kontaktcenter"}
required_national = {"forsakringskassan","pensionsmyndigheten","arbetsformedlingen","csn","skatteverket","migrationsverket","servicecenter","transportstyrelsen","trafikverket","polisen","kronofogden","domstolar","lantmateriet","do","imy","hallakonsument","konsumentverket","arn","arbetsmiljoverket","bolagsverket","verksamt","valmyndigheten"}
assert required_local <= {x["id"] for x in local}; assert required_national <= {x["id"] for x in national}
for x in national: assert x.get("url", "").startswith("https://")
local_ids = {x["id"] for x in local}
for m in data["municipalities"].values():
    assert m.get("website", "").startswith("https://")
    for key, url in m.get("serviceUrls", {}).items(): assert key in local_ids and url.startswith("https://")
assert next(x for x in national if x["id"] == "migrationsverket")["group"] == "Skatt, flytt & identitet"
print(f"Myndighetsguiden godkänd: {len(local)} kommunala behov, {len(national)} nationella ingångar, {len(data['municipalities'])} kommuner.")
''', encoding="utf-8")
