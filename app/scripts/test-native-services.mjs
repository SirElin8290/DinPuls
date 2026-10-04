import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
async function module(path,globals){
 const result=await build({entryPoints:[new URL('../src/'+path,import.meta.url).pathname.replace(/^\/(.:)/,'$1')],bundle:true,format:'iife',globalName:'Subject',write:false,
  plugins:[{name:'native-mocks',setup(b){b.onResolve({filter:/^@capacitor\//},a=>({path:a.path,namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},a=>({contents:a.path.endsWith('core')?'export const Capacitor=globalThis.cap;':a.path.endsWith('push-notifications')?'export const PushNotifications=globalThis.push;':a.path.endsWith('filesystem')?'export const Filesystem=globalThis.files;export const Directory={Cache:"CACHE"};':'export const Share=globalThis.share;'}));}}]});
 const context={...globals,URL,Blob,Uint8Array,Promise,Date,JSON,crypto:webcrypto,setTimeout(){}};vm.createContext(context);vm.runInContext(result.outputFiles[0].text,context);return context.Subject;
}
for(const platform of ['android','ios'])test(platform+' push permission, token/settings sync, foreground notice, safe routing and unsubscribe',async()=>{
 const listeners={},calls=[],store=new Map();let notice;
 class Element{
  constructor(){this.handlers={};this.dataset={};this.children=[];this.hidden=false;this.checked=false;}
  addEventListener(k,fn){this.handlers[k]=fn;}insertAdjacentElement(p,e){this.inserted=e;}setAttribute(k,v){this[k]=v;}append(...e){this.children.push(...e);}remove(){if(notice===this)notice=null;}
 }
 const enable=new Element(),disable=new Element(),help=new Element(),status=new Element(),news=new Element();news.dataset.pushCategory='news';
 const doc={querySelector:s=>({'#push-enable':enable,'#push-disable':disable,'#push-help':help,'#push-status':status}[s]||(s==='.app-push-notice'?notice:null)),querySelectorAll:s=>s.endsWith(':checked')?(news.checked?[news]:[]):[news],createElement:()=>new Element(),addEventListener(k,f){listeners[k]=f;},body:{append(e){notice=e;}}};
 const location={origin:'https://localhost',href:'https://localhost/index.html'};const events={};let permissions=0,registrations=0,unregistered=0;
 const subject=await module('native-push.js',{cap:{getPlatform:()=> platform},push:{async addListener(k,f){events[k]=f;},async checkPermissions(){return {receive:'prompt'};},async requestPermissions(){permissions++;return {receive:'granted'};},async createChannel(){assert.equal(platform,'android');},async register(){registrations++;},async unregister(){unregistered++;}},
  document:doc,window:{DinPulsMunicipality:{getName:()=> 'Åmål'}},location,__DINPULS_PAGES__:['/index.html','/lunch.html'],localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  async fetch(url,options){calls.push({url,options});return {ok:true,json:async()=>({ok:true,androidConfigured:true,iosConfigured:true,message:'Accepted, receipt not proven'})};}});
 await subject.initializeNativePush();assert.equal(status.dataset.state,'inactive');assert.equal(permissions,0,'No permission prompt without opt-in');
 await enable.handlers.click();assert.equal(permissions,1);assert.equal(registrations,1);
 await events.registration({value:'isolated-fcm-device-token'});assert.equal(status.dataset.state,'active');assert.equal(store.get('dp-native-push-token'),'isolated-fcm-device-token');
 assert.equal(JSON.parse(calls.at(-1).options.body).platform,platform);
 news.checked=true;await news.handlers.change();assert.deepEqual(JSON.parse(calls.at(-1).options.body).categories,['news']);
 events.pushNotificationReceived({title:'<script>unsafe</script>',body:'A real notification',data:{path:'/lunch.html?kommun=Kil'}});
 assert.equal(notice.children[0].textContent,'<script>unsafe</script> · A real notification');assert(store.has('dp-native-push-last-receipt'));
 notice.children[0].onclick();assert.equal(location.href,'/lunch.html?kommun=Kil');assert.equal(notice,null);
 events.pushNotificationActionPerformed({notification:{data:{path:'https://evil.example.test/'}}});assert.equal(location.href,'/lunch.html?kommun=Kil');
 await disable.handlers.click();assert.equal(unregistered,1);assert.equal(calls.at(-1).options.method,'DELETE');assert(!store.has('dp-native-push-token'));
});
test('Native PDF keeps authenticated bytes, validates format, sanitizes name and shares cache file',async()=>{
 let written,shared;
 class Reader {readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:application/pdf;base64,'+Buffer.from(b).toString('base64');this.onload();});}}
 const subject=await module('native-files.js',{FileReader:Reader,files:{async writeFile(options){written=options;return {uri:'file:///cache/contracts/contract.pdf'};}},share:{async share(options){shared=options;}}});
 const bytes='%PDF-1.7\nIsolated existing test bytes';const uri=await subject.savePdf(new Blob([bytes],{type:'application/pdf'}),'../../contract.pdf');
 assert.equal(written.directory,'CACHE');assert(!written.path.includes('../'));assert.equal(Buffer.from(written.data,'base64').toString(),bytes);assert.equal(shared.files[0],uri);
 await assert.rejects(()=>subject.savePdf(new Blob(['not-pdf']),'bad.pdf'),/giltig PDF/);
});
