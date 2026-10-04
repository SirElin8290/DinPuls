import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
const BASE='https://dinpuls-push.soren-johansson-7.workers.dev/native-push';
const KEY='dp-native-push-installation',TOKEN='dp-native-push-token';
function installation(){let value=localStorage.getItem(KEY);if(!value){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,value);}return value;}
async function api(path,method='GET',body,secret=installation()){const response=await fetch(BASE+path,{method,headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok||!value.ok)throw new Error(value.error||'Pushanslutningen svarade inte.');return value;}
export async function initializeNativePush(){
  const deviceSecret=installation();
  const request=(path,method,body)=>api(path,method,body,deviceSecret);
  const enable=document.querySelector('#push-enable'),disable=document.querySelector('#push-disable'),help=document.querySelector('#push-help'),status=document.querySelector('#push-status');
  if(!enable||!disable||!help||!status)return;
  const state=(kind,text)=>{status.dataset.state=kind;status.textContent=text;};
  help.textContent='Tillåt notiser och använd sedan testknappen för just denna telefon.';
  const fail=error=>{state('error',error.message||'Push kunde inte anslutas.');enable.disabled=false;};
  if(Capacitor.getPlatform()!=='android'){enable.disabled=true;disable.hidden=true;state('setup','iPhone-notiser är ännu inte anslutna.');return;}
  const selected=()=>[...document.querySelectorAll('[data-push-category]:checked')].map(c=>c.dataset.pushCategory);
  const save=token=>request('/device','PUT',{platform:'android',token,municipality:window.DinPulsMunicipality?.getName?.()||'Åmål',categories:selected()});
  const active=()=>{enable.hidden=true;disable.hidden=false;enable.disabled=false;state('active','Android-push är ansluten. Verifiera mottagning med en testnotis.');test.hidden=false;};
  const test=document.createElement('button');test.type='button';test.textContent='Skicka testnotis till denna telefon';test.hidden=true;disable.insertAdjacentElement('afterend',test);
  test.addEventListener('click',async()=>{test.disabled=true;try{const response=await request('/test','POST');help.textContent=response.message;}catch(error){fail(error);}finally{test.disabled=false;}});
  let settings={categories:['traffic','transport']};try{settings=JSON.parse(localStorage.getItem('dinpuls-push-settings-v1'))||settings;}catch{}
  for(const input of document.querySelectorAll('[data-push-category]')){input.checked=(settings.categories||[]).includes(input.dataset.pushCategory);input.addEventListener('change',async()=>{localStorage.setItem('dinpuls-push-settings-v1',JSON.stringify({categories:selected()}));const token=localStorage.getItem(TOKEN);if(token)try{await save(token);}catch(error){fail(error);}});}
  document.addEventListener('dinpuls:municipalitychange',async()=>{const token=localStorage.getItem(TOKEN);if(token)try{await save(token);}catch(error){fail(error);}});
  await PushNotifications.addListener('registration',async({value})=>{try{await save(value);localStorage.setItem(TOKEN,value);active();}catch(error){fail(error);}});
  await PushNotifications.addListener('registrationError',()=>fail(new Error('Android kunde inte registrera enheten hos Firebase.')));
  await PushNotifications.addListener('pushNotificationReceived',()=>{localStorage.setItem('dp-native-push-last-receipt',new Date().toISOString());help.textContent='En pushnotis har tagits emot av Android-appen.';});
  await PushNotifications.addListener('pushNotificationActionPerformed',({notification})=>{try{const url=new URL(notification.data?.path||'/index.html',location.origin);if(url.origin===location.origin&&__DINPULS_PAGES__.includes(url.pathname))location.href=url.pathname+url.search;}catch{}});
  enable.addEventListener('click',async()=>{enable.disabled=true;try{const permission=await PushNotifications.requestPermissions();if(permission.receive!=='granted')throw new Error('Tillåt Android-notiser för DinPuls i telefonens inställningar.');await PushNotifications.createChannel({id:'dinpuls',name:'DinPuls',importance:4});await PushNotifications.register();}catch(error){fail(error);}});
  const stop=async()=>{await request('/device','DELETE');await PushNotifications.unregister();localStorage.removeItem(TOKEN);test.hidden=true;enable.hidden=false;disable.hidden=true;state('inactive','Android-push är avstängd.');};
  disable.addEventListener('click',()=>stop().catch(fail));
  document.addEventListener('dinpuls:local-settings-cleared',()=>stop().catch(fail));
  try{const config=await request('/config');if(!config.androidConfigured)throw new Error('Androids serveranslutning är inte konfigurerad.');const permission=await PushNotifications.checkPermissions();if(localStorage.getItem(TOKEN)&&permission.receive==='granted'){await PushNotifications.createChannel({id:'dinpuls',name:'DinPuls',importance:4});await PushNotifications.register();}else{enable.disabled=false;disable.hidden=true;state('inactive','Aktivera Android-push på denna telefon.');}}catch(error){fail(error);}
}
