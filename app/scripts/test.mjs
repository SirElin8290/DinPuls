import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('live data rewrite preserves body, credentials and external requests',async()=>{
 const code=(await readFile(new URL('../src/native.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const calls=[],listeners={};
 const context={initializeNativePush(){},sessionStorage:{getItem(){return null;},setItem(){}},__DINPULS_PAGES__:["/index.html","/lunch.html"],Keyboard:{addListener(){}},URL,Request,location:{href:'https://localhost/foretag/index.html',origin:'https://localhost'},Capacitor:{isNativePlatform:()=>true},App:{addListener(){},getLaunchUrl:()=>Promise.resolve()},Browser:{open(){}},navigator:{onLine:true},window:{fetch:(...args)=>{calls.push(args);return Promise.resolve({ok:true});},addEventListener(){}},document:{addEventListener:(name,fn)=>{listeners[name]=fn;},documentElement:{classList:{toggle(){}}}}};
 vm.runInNewContext(code,context);
 await context.window.fetch('../data/lunch.json?week=41',{cache:'no-cache'});
 assert.equal(calls[0][0],'https://dinpuls.se/data/lunch.json?week=41');
 const init={method:'POST',headers:{Authorization:'Bearer test-only'},body:'{"example":true}'};
 await context.window.fetch('https://api.example.test/login',init);
 assert.deepEqual(calls[1],['https://api.example.test/login',init]);
 await context.window.fetch('../components/sport.html');assert.equal(calls[2][0],'../components/sport.html');
});

test('packaged app contains all public entry points without secrets or stale feeds',async()=>{
 for(const path of ['index.html','lunch.html','evenemang.html','foreningsliv.html','forening.html','foretag/start.html','foretag/index.html','foreningar-konto.html']){
  const html=await readFile(new URL('../www/'+path,import.meta.url),'utf8');assert(html.includes('src="/native.js"'),path);assert(html.includes('viewport-fit=cover'),path);
 }
 const {readdir}=await import('node:fs/promises');
 assert.deepEqual(await readdir(new URL('../www/data/',import.meta.url)),['municipalities.json']);
 const config=JSON.parse(await readFile(new URL('../capacitor.config.json',import.meta.url),'utf8'));
 assert((await readFile(new URL('../www/admin/ad-inventory.js',import.meta.url),'utf8')).length>0);
 assert(!config.server?.url);assert.equal(config.plugins.CapacitorHttp.enabled,true);
});

test('native links stay in app; external sources use the browser',async()=>{
 const code=(await readFile(new URL('../src/native.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const listeners={},opened=[];
 const context={initializeNativePush(){},sessionStorage:{getItem(){return null;},setItem(){}},__DINPULS_PAGES__:['/index.html','/lunch.html'],URL,Request,Keyboard:{addListener(){}},Capacitor:{isNativePlatform:()=>true},App:{addListener(){},getLaunchUrl:()=>Promise.resolve()},Browser:{open:options=>{opened.push(options.url);return Promise.resolve();}},location:{href:'https://localhost/index.html',origin:'https://localhost'},navigator:{onLine:true},initializeNativePush(){},window:{fetch(){},addEventListener(){}},document:{addEventListener:(name,fn)=>{listeners[name]=fn;},documentElement:{classList:{toggle(){}}}}};
 vm.runInNewContext(code,context);
 function click(href){let prevented=false;listeners.click({target:{closest:()=>({href,hasAttribute:()=>false})},preventDefault(){prevented=true;}});return prevented;}
 assert(click('https://dinpuls.se/lunch.html?kommun=Kil#menu'));assert.equal(context.location.href,'/lunch.html?kommun=Kil#menu');
 context.location.href='https://localhost/index.html';
 assert(click('https://official.example.test/menu'));assert.deepEqual(opened,['https://official.example.test/menu']);
 assert(click('https://dinpuls.se/not-packaged.html'));assert.equal(opened[1],'https://dinpuls.se/not-packaged.html');
 assert.equal(click('mailto:info@example.test'),false);
});

test('cold app link is handled once, preventing a navigation loop',async()=>{
 const code=(await readFile(new URL('../src/native.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const stored=new Map(),events={};
 const context={initializeNativePush(){},sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},__DINPULS_PAGES__:['/index.html','/lunch.html'],URL,Request,Keyboard:{addListener(){}},Capacitor:{isNativePlatform:()=>true},App:{addListener:(n,fn)=>events[n]=fn,getLaunchUrl:()=>Promise.resolve({url:'dinpuls://app/lunch.html?kommun=Kil'})},Browser:{open(){}},location:{href:'https://localhost/index.html',origin:'https://localhost'},navigator:{onLine:true},initializeNativePush(){},window:{fetch(){},addEventListener(){}},document:{addEventListener(){},documentElement:{classList:{toggle(){}}}}};
 vm.runInNewContext(code,context);await new Promise(resolve=>setImmediate(resolve));assert.equal(context.location.href,'/lunch.html?kommun=Kil');
 context.location.href='https://localhost/index.html';vm.runInNewContext(code,context);await new Promise(resolve=>setImmediate(resolve));assert.equal(context.location.href,'https://localhost/index.html');
 events.appUrlOpen({url:'dinpuls://app/unknown.html'});assert.equal(context.location.href,'https://localhost/index.html');
 events.appUrlOpen({url:'https://evil.example.test/lunch.html'});assert.equal(context.location.href,'https://localhost/index.html');
 events.appUrlOpen({url:'dinpuls://app/lunch.html?kommun=Arvika'});assert.equal(context.location.href,'/lunch.html?kommun=Arvika');
});
