import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

if(Capacitor.isNativePlatform()){
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
 });
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented)return;
  const url=new URL(link.href,location.href);
  if(['http:','https:'].includes(url.protocol)&&url.origin!==location.origin){
   event.preventDefault();Browser.open({url:url.href}).catch(()=>{location.href=url.href;});
  }
 });
 App.addListener('backButton',({canGoBack})=>{if(canGoBack)history.back();else App.exitApp();});
 App.addListener('appStateChange',({isActive})=>{if(isActive)updateConnection();});
}
