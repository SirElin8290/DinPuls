import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync('push-service-worker.js','utf8');
const handlers={};let displayed,opened,wait;
vm.runInNewContext(source,{
  URL,
  self:{location:{origin:'https://dinpuls.se'},addEventListener:(name,fn)=>handlers[name]=fn,
    registration:{showNotification:async(title,options)=>{displayed={title,...options};}}},
  clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;}}
});
handlers.push({data:{json:()=>({title:'Test på min enhet',body:'Test',url:'/?kommun=Kil'})},waitUntil:p=>wait=p});
await wait;
assert.equal(displayed.title,'Test på min enhet');
assert.equal(displayed.body,'Test');
assert.equal(displayed.data.url,'/?kommun=Kil');
for(const [url,expected] of [
  ['/?kommun=Kil','https://dinpuls.se/?kommun=Kil'],
  ['https://example.com/','https://dinpuls.se/'],
  ['javascript:alert(1)','https://dinpuls.se/'],
  ['http://[','https://dinpuls.se/']
]){
  handlers.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>wait=p});
  await wait;assert.equal(opened,expected);
}
console.log('PASS: push-event visas och klick öppnar endast DinPuls. Simulerat event, inte verklig leverans.');

const backend=readFileSync('cloudflare/push-worker.js','utf8');
const testFunction=backend.slice(backend.indexOf('async function sendTestNotification('),backend.indexOf('\nexport default {'));
let sends=0,bindings=[];
const context=vm.createContext({
  json:(_request,data,status=200)=>({data,status}),
  isSupportedMunicipality:value=>value==='Kil',
  endpointHash:async value=>'hash:'+value,
  configureWebPush(){},
  webpush:{sendNotification:async()=>{sends++;return {statusCode:201};}},
  console,Date,JSON
});
vm.runInContext(testFunction,context);
const env={PUSH_ADMIN_TOKEN:'test-only',DB:{prepare:sql=>({bind:(...args)=>{
  bindings.push({sql,args});return {first:async()=>({endpoint_hash:'test',endpoint:'https://test.example/device',p256dh:'test',auth:'test'}),run:async()=>({})};
}})}};
const request=(body,token='test-only')=>({headers:{get:()=>token},json:async()=>body});
assert.equal((await context.sendTestNotification(request({municipality:'Kil'},'wrong'),env)).status,401);
assert.equal((await context.sendTestNotification(request({municipality:'Kil'}),env)).status,400);
assert.equal(sends,0);
assert.equal((await context.sendTestNotification(request({municipality:'Kil',endpoint:'https://test.example/device'}),env)).status,200);
assert.equal(sends,1);
assert.match(bindings[0].sql,/endpoint_hash = \?/);
assert.deepEqual(Array.from(bindings[0].args),['Kil','hash:https://test.example/device']);
console.log('PASS: testsändning kräver admin och exakt enhet; ingen godtycklig kommunprenumerant väljs. Mockad transport.');
