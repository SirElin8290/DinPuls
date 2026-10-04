import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';

if(Capacitor.isNativePlatform()){
 const localPages=new Set(__DINPULS_PAGES__);
 const keyboardVisible=visible=>document.documentElement.classList.toggle('app-keyboard-open',visible);
 Keyboard.addListener('keyboardWillShow',()=>keyboardVisible(true));
 Keyboard.addListener('keyboardDidShow',()=>{keyboardVisible(true);document.activeElement?.scrollIntoView?.({block:'center',behavior:'smooth'});});
 Keyboard.addListener('keyboardWillHide',()=>keyboardVisible(false));
 const originalFetch=window.fetch.bind(window);
 window.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin===location.origin&&url.pathname.startsWith('/data/')){
   const remote='https://dinpuls.se'+url.pathname+url.search;
   return originalFetch(input instanceof Request?new Request(remote,input):remote,init);
  }
  return originalFetch(input,init);
 };
 // Webbläsarens service worker behövs inte för paketerad appkod.
 if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('Paketerad app använder ingen webbläsar-service-worker.'));
 const noticeExternalFailure=()=>{const notice=document.querySelector('.app-network-notice');if(notice){notice.textContent='Länken kunde inte öppnas. Försök igen.';notice.style.display='block';}};
 const updateConnection=()=>{document.documentElement.classList.toggle('app-offline',!navigator.onLine);};
 window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
 document.addEventListener('DOMContentLoaded',()=>{
  document.documentElement.classList.add('native-app');
  const notice=document.createElement('div');notice.className='app-network-notice';notice.role='status';notice.textContent='Ingen internetanslutning. Aktuella uppgifter behöver hämtas när du är online.';document.body.prepend(notice);updateConnection();
  const nav=document.createElement('nav');nav.className='app-navigation';nav.setAttribute('aria-label','Appnavigation');
  const municipality=window.DinPulsMunicipalityState?.getInitial?.()||new URLSearchParams(location.search).get('kommun')||'';
  for(const [label,path] of [['Hem','/index.html'],['Lunch','/lunch.html'],['Kalender','/evenemang.html'],['Föreningar','/foreningsliv.html']]){
   const link=document.createElement('a');link.textContent=label;link.href=path+(municipality?'?kommun='+encodeURIComponent(municipality):'');if(location.pathname===path)link.setAttribute('aria-current','page');nav.append(link);
  }
  document.body.append(nav);
  document.addEventListener('dinpuls:municipalitychange',({detail})=>{
   for(const link of nav.querySelectorAll('a')){const url=new URL(link.href);url.searchParams.set('kommun',detail.name);link.href=url.href;}
  });
 });
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented)return;
  const url=new URL(link.href,location.href);
  if(url.protocol==='https:'&&['dinpuls.se','www.dinpuls.se'].includes(url.hostname)&&localPages.has(url.pathname==='/'?'/index.html':url.pathname)){
   event.preventDefault();location.href=(url.pathname==='/'?'/index.html':url.pathname)+url.search+url.hash;return;
  }
  if(['http:','https:'].includes(url.protocol)&&(url.origin!==location.origin||link.hasAttribute('download'))){
   event.preventDefault();const target=url.origin===location.origin?'https://dinpuls.se'+url.pathname+url.search+url.hash:url.href;
   Browser.open({url:target}).catch(()=>{noticeExternalFailure();});
  }
 });
 App.addListener('backButton',({canGoBack})=>{if(canGoBack)history.back();else App.exitApp();});
 App.addListener('appStateChange',({isActive})=>{if(isActive)updateConnection();});
}
