import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('live data rewrite preserves body, credentials and external requests',async()=>{
 const code=(await readFile(new URL('../src/native.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const calls=[],listeners={};
 const context={URL,Request,location:{href:'https://localhost/foretag/index.html',origin:'https://localhost'},Capacitor:{isNativePlatform:()=>true},App:{addListener(){}},Browser:{open(){}},navigator:{onLine:true},window:{fetch:(...args)=>{calls.push(args);return Promise.resolve({ok:true});},addEventListener(){}},document:{addEventListener:(name,fn)=>{listeners[name]=fn;},documentElement:{classList:{toggle(){}}}}};
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
 assert(!config.server?.url);assert.equal(config.plugins.CapacitorHttp.enabled,true);
});
