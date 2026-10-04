const fs = require('fs'), vm = require('vm'), assert = require('assert');
let source = fs.readFileSync('foreningsliv.js', 'utf8');
source = source.slice(0, source.indexOf('(async()=>{try{const [items,sports]')) + 'window.test={load,listPage,profilePage,profileMeta,profileLinks,matchForClub,fmtStanding};})();';
const municipalities = JSON.parse(fs.readFileSync('data/municipalities.json', 'utf8')).municipalities;
const sports = JSON.parse(fs.readFileSync('data/sports.json', 'utf8'));
const leisure = JSON.parse(fs.readFileSync('data/leisure.json', 'utf8'));
(async () => {
  let count = 0;
  for (const municipality of municipalities) {
    const elements = {}, root = {innerHTML:''};
    const window = {DinPulsMunicipalityState:{getInitial:()=>municipality.name}};
    const document = {querySelectorAll:()=>[],querySelector:key=>key==='#association-profile'?root:(elements[key] ||= {value:'',innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return [];},focus(){}})};
    let sportsRequests = 0;
    const context = {window,document,location:{search:''},URL,URLSearchParams,Date,console,fetch:async url=>{if(url==='data/sports.json')sportsRequests++;return {ok:true,json:async()=>url==='data/sports.json'?sports:url==='data/leisure.json'?leisure:url==='data/business-config.json'?{apiBase:'https://example.invalid'}:{profile:null}};}};
    vm.createContext(context);vm.runInContext(source,context);
    const api=window.test, items=await api.load();await api.load();assert.equal(sportsRequests,1);
    await api.listPage(items);assert(elements['#association-status'].textContent.includes(municipality.name));
    for(const item of items){context.location.search='?slug='+encodeURIComponent(item.slug);await api.profilePage(items,sports);assert(!root.innerHTML.includes('Föreningen hittades inte'));assert(root.innerHTML.includes('<h1>'));count++;}
    assert(!api.matchForClub({homeTeam:'',awayTeam:'Annan klubb'},'Kontroll'));
    assert(api.matchForClub({homeTeam:'Kontroll Herr'},'Kontroll'));
    assert(api.profileMeta({address:'Gatan 1',contact:{email:'kontakt@example.test',phone:'010 123'}}).includes('Gatan 1'));
    assert(api.profileLinks({url:'https://example.test/foreningsregister'}).includes('Föreningsregister / källa'));
    assert(api.profileLinks({url:'https://example.test/'}).includes('href="https://example.test/"'));
    assert(!api.profileLinks({url:'javascript:alert(1)'}).includes('href="javascript:'));
  }
  console.log(`PASS: ${count} profiler i 21 kommuner; listkörning, adress, källa, säkra länkar och isolering.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
