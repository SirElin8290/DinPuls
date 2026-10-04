// Only copied into the isolated instrumentation build, never into distributed APK/AAB.
if(sessionStorage.getItem('dp-isolated-e2e')==='true'){
 const upstream=window.fetch.bind(window);
 window.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.pathname.startsWith('/data/')||url.hostname==='dinpuls-push.soren-johansson-7.workers.dev'){
   const target='http://127.0.0.1:8788'+url.pathname+url.search;
   return upstream(input instanceof Request?new Request(target,input):target,init);
  }
  return upstream(input,init);
 };
 window.__e2eAlerts=[];window.alert=text=>window.__e2eAlerts.push(String(text));
 window.__e2eLoginFlash=false;
 new MutationObserver(()=>{const p=document.querySelector('#loginView');if(p&&!p.hidden&&sessionStorage.getItem('dp-company-session'))window.__e2eLoginFlash=true;}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['hidden']});
}
