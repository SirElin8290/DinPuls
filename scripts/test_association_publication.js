const fs=require('fs'),vm=require('vm'),assert=require('assert');
const frontend=fs.readFileSync('foreningsliv.js','utf8');
const worker=fs.readFileSync('cloudflare/push-worker.js','utf8');
const frontPredicate=frontend.match(/const publishable=(.*);/)[1];
const backendPredicate=worker.slice(worker.indexOf('function associationPublishable('),worker.indexOf('function associationCatalog('));
const context={};vm.createContext(context);
vm.runInContext(`const publishable=${frontPredicate};${backendPredicate};this.front=publishable;this.back=associationPublishable`,context);
for(const [row,expected] of [
 [{name:'Bara ett namn'},false],
 [{description:'  '},false],
 [{description:'Exempelföreningen bedriver lokal medlemsverksamhet.'},false],
 [{description:'Arrangerar körsång och konserter.',status:'active_verified'},true],
 [{description:'Arrangerar körsång och konserter.'},true],
 [{description:'Arrangerar körsång och konserter.',status:'inactive'},false]
]){assert.equal(context.front(row),expected);assert.equal(context.back(row),expected);}
// Importer/STRICT kan återlägga råposten; publiceringsgrinden gäller ändå.
let published=0,excluded=0;
for(const [file,key] of [['sports.json','clubs'],['leisure.json','activities']]){
 const data=JSON.parse(fs.readFileSync('data/'+file,'utf8'));
 for(const value of Object.values(data.municipalities))for(const row of value[key]){
  assert.equal(context.front(row),context.back(row),row.name);
  if(context.front(row)){assert(row.description.trim());published++;}
  else if(!row.status||['active','active_verified'].includes(row.status))excluded++;
 }
}
assert(excluded>0);assert(published>0);
console.log(`PASS: gemensam publiceringsregel frontend/API, ${excluded} tunna råposter blockerade, verifierade beskrivningar bevarade.`);
