// Drives the real WKWebView through a bridge compiled ONLY with IOS_CI.
// Reuses Android's isolated account/purchase assertions against the local CI backend.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:8788',report={platform:'ios-simulator',checks:[],productionDelivery:false};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(script){
 const {id}=await fetch(base+'/__test/command',{method:'POST',body:JSON.stringify({script})}).then(r=>r.json());
 for(let i=0;i<150;i++){
  const result=await fetch(base+'/__test/result?id='+id).then(r=>r.json());
  if(result.id===id){if(result.error)throw Error(result.error);return result.value;}
  await wait(100);
 }
 throw Error('iOS test bridge did not answer');
}
async function until(script){
 const deadline=Date.now()+60000;let error;
 while(Date.now()<deadline){try{if(await evaluate('Boolean('+script+')'))return;}catch(e){error=e.message;}await wait(300);}
 throw Error('Timed out: '+script+' '+(error||''));
}
async function screenshot(name){await wait(700);execFileSync('xcrun',['simctl','io','booted','screenshot','ios-qa/'+name+'.png'],{stdio:'inherit'});}
await mkdir('ios-qa',{recursive:true});
try{
 await until("!!document.querySelector('.app-navigation')");
 await evaluate("localStorage.setItem('dinpuls-municipality','Åmål');location.href='/index.html?kommun='+encodeURIComponent('Åmål');");
 await until("!!document.querySelector('#homepage-customize-button')&&typeof HOME_OPTIONAL_MODULES!=='undefined'");
 await evaluate("document.querySelector('[data-privacy-essential-only]')?.click();document.querySelector('#homepage-customize-button').click();document.querySelector('#homepage-customize-reset').click();for(const c of document.querySelectorAll('[data-home-module]'))if(c.checked)c.click();document.querySelector('#homepage-customize-dialog').close();");
 const hidden="[...document.querySelectorAll('[data-home-module]')].every(c=>!c.checked&&HOME_OPTIONAL_MODULES[c.dataset.homeModule].every(selector=>[...document.querySelectorAll(selector)].every(el=>el.hidden&&getComputedStyle(el).display==='none')))";
 await until(hidden);await evaluate('location.reload()');await until("typeof HOME_OPTIONAL_MODULES!=='undefined'&&!!document.querySelector('.app-navigation')");await until(hidden);
 await evaluate("document.querySelector('#homepage-customize-button').click();document.querySelector('#homepage-customize-reset').click();document.querySelector('#homepage-customize-dialog').close();");
 report.checks.push('module hiding persists across page reload and reset');
 assert.equal(await evaluate("document.documentElement.dataset.nativePlatform"),'ios');
 await screenshot('home');
 // This bridge build fetches local fixtures after opt-in; never purchases in production.
 const java=await readFile(new URL('../android/app/src/androidTest/java/se/dinpuls/app/AppSmokeTest.java',import.meta.url),'utf8');
 const chain=java.slice(java.indexOf('@Test public void isolatedAccountPurchaseBannerChain()'));
 const commands=[...chain.matchAll(/(evaluate|awaitTrue|awaitStableTrue)\(app,("(?:\\.|[^"\\])*")\);/g)].map(m=>({type:m[1],script:JSON.parse(m[2])}));
 assert(commands.length>30,'Shared account test source was not recognized');
 for(const command of commands){
  let script=command.script.replaceAll('ANDROID TEST','IOS TEST').replaceAll('android@example.invalid','ios@example.invalid');
  if(script.includes("location.href='/foretag/kop.html'")){
   for(const view of ['overview','banners','purchases','contract','profile']){await evaluate(`document.querySelector('[data-view="${view}"]').click()`);await until(`!document.querySelector('#${view}').hidden`);}
   assert.equal(await evaluate('window.__e2eLoginFlash'),false);
   report.checks.push('single login without old-login flash, all five portal views');
  }
  if(command.type==='evaluate')await evaluate(script);else await until(script);
  if(script.includes("window.ciPdf.includes"))report.checks.push('real iOS native PDF cache write');
  if(script.includes("ciOldStatus===401"))report.checks.push('password reset invalidates previous session');
  if(command.type==='awaitStableTrue'){assert.equal(await evaluate('JSON.stringify(window.__e2eAlerts)'), '[]');await screenshot('public-ad');}
 }
 report.checks.push('registration, activation, password, login, purchase, signature, banner upload, approval and visible public image; captured email calls');
 for(const page of ['lunch.html','evenemang.html','foreningsliv.html','skola-familj.html','praktiskt.html','kris-beredskap.html','foretag/start.html','foreningskonto.html']){
  await evaluate(`location.href='/${page}?kommun='+encodeURIComponent('Åmål')`);
  await until("!!document.querySelector('.app-navigation')&&document.readyState==='complete'");
  await wait(1500);
  await until('document.documentElement.scrollWidth<=innerWidth+1');
  await screenshot(page.replaceAll('/','-').replace('.html',''));
 }
 report.checks.push('eight packaged pages open on iPhone without horizontal overflow');
 report.pass=true;
}catch(error){report.pass=false;report.error=error.message;await screenshot('failure').catch(()=>{});throw error;}
finally{await writeFile('ios-qa/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
