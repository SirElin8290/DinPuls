const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { publicDestination } = require('../analytics-events.js');
const base = 'https://dinpuls.se/?kommun=Åmål';
assert.equal(publicDestination('/lunch.html?kommun=Åmål&email=private@example.com#menu', base), '/lunch.html?kommun=%C3%85m%C3%A5l');
assert.equal(publicDestination('/forening.html?kommun=Kil&slug=kil-if&token=secret', base), '/forening.html?kommun=Kil&slug=kil-if');
for (const url of ['https://other.example/lunch.html', 'mailto:test@example.com', '/admin/index.html', '/foretag/index.html', '/foreningsadmin.html', '/api/customer']) assert.equal(publicDestination(url, base), null);
let listener, allowed = false;
const events = [];
const card = {id:'evenemang',dataset:{}};
const link = {href:'https://dinpuls.se/evenemang.html?kommun=Åmål',hasAttribute:()=>false,closest:s=>s==='form'?null:s.startsWith('article')?card:null};
vm.runInNewContext(fs.readFileSync(require.resolve('../analytics-events.js'),'utf8'), {
  URL, URLSearchParams,
  location: {href:base,pathname:'/',search:'?kommun=Åmål'},
  window: {DinPulsPrivacy:{analyticsAllowed:()=>allowed},gtag:(...args)=>events.push(args)},
  document:{addEventListener:(name,fn)=>{if(name==='click') listener=fn;}}
});
const target = {closest:s=>s==='a[href]'?link:s.startsWith('article')?card:null};
listener({target});
assert.equal(events.length,0,'No click analytics without consent');
allowed=true;
listener({target});
assert.equal(events.length,2);
assert.equal(events[0][1],'internal_link_click');
assert.equal(events[1][1],'module_click');
assert.equal(events[1][2].module_id,'evenemang');
allowed=false;
listener({target});
assert.equal(events.length,2,'Revoked consent stops events');
console.log('✓ Consent, internal module clicks and safe public identifiers');
