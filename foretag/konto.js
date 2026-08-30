(function(){
  "use strict";
  const $=selector=>document.querySelector(selector);
  let apiBase="", token="", purpose="";
  async function api(path,body){
    const response=await fetch(`${apiBase}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
    const data=await response.json().catch(()=>({ok:false,error:"Servern gav ett ogiltigt svar."}));
    if(!response.ok)throw Object.assign(new Error(data.error||"Begäran misslyckades."),{state:data.state});
    return data;
  }
  function hideAll(){["loading","statusView","passwordForm","resetRequestForm"].forEach(id=>$("#"+id).hidden=true)}
  function showStatus(title,message){hideAll();$("#statusTitle").textContent=title;$("#statusMessage").textContent=message;$("#statusView").hidden=false}
  function tokenError(error){
    if(error.state==="expired")return showStatus("Länken har gått ut","Be DinPuls skicka en ny aktiveringslänk, eller använd Glömt lösenord om kontot redan är aktiverat.");
    if(error.state==="used")return showStatus("Länken är redan använd","Länken kan bara användas en gång. Prova att logga in med lösenordet du valde.");
    showStatus("Länken är ogiltig","Kontrollera att hela länken öppnades eller be DinPuls om en ny.");
  }
  async function init(){
    const config=await fetch("../data/business-config.json",{cache:"no-store"}).then(response=>response.json());
    apiBase=String(config.apiBase||"").replace(/\/$/,"");
    const params=new URLSearchParams(location.hash.slice(1)); token=params.get("token")||"";purpose=params.get("purpose")||"";
    if(!token){hideAll();$("#resetRequestForm").hidden=false;return}
    try{
      const result=await api("/portal/account/token/verify",{token,purpose});
      hideAll();$("#formTitle").textContent=purpose==="reset-password"?"Välj ett nytt lösenord":"Skapa ditt lösenord";
      $("#companyText").textContent=result.company?`Företagskonto för ${result.company}.`:"Välj ett säkert lösenord för företagskontot.";
      $("#passwordForm").hidden=false;
    }catch(error){tokenError(error)}
  }
  $("#passwordForm").onsubmit=async event=>{
    event.preventDefault();$("#formError").hidden=true;
    try{
      const result=await api(purpose==="reset-password"?"/portal/account/reset/complete":"/portal/account/password",{token,purpose,password:$("#newPassword").value,passwordConfirmation:$("#confirmPassword").value});
      history.replaceState(null,"",location.pathname);showStatus("Klart!",result.message);
    }catch(error){if(error.state)return tokenError(error);$("#formError").textContent=error.message;$("#formError").hidden=false}
  };
  $("#resetRequestForm").onsubmit=async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try{const result=await api("/portal/account/reset/request",{email:$("#resetEmail").value.trim()});$("#resetMessage").textContent=result.message;$("#resetMessage").hidden=false;$("#resetEmail").value=""}
    catch{$("#resetMessage").textContent="Begäran kunde inte skickas just nu. Försök igen senare.";$("#resetMessage").hidden=false}
    finally{button.disabled=false}
  };
  init().catch(()=>showStatus("Tjänsten kunde inte öppnas","Försök igen om en stund eller kontakta DinPuls."));
})();
