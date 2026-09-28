const params=new URLSearchParams(location.search),municipality=params.get("kommun")||"",association=params.get("forening")||"";
const withContext=(path,mode="")=>{const p=new URLSearchParams();if(mode)p.set("mode",mode);if(municipality)p.set("kommun",municipality);if(association)p.set("forening",association);return path+(p.size?"?"+p:"")};
for(const id of ["loginCta","loginBottom"]){const el=document.getElementById(id);if(el)el.href=withContext("foreningskonto.html")}
for(const id of ["registerCta","registerBottom"]){const el=document.getElementById(id);if(el)el.href=withContext("foreningskonto.html","register")}
const infoBack=document.getElementById("infoBack");if(infoBack&&municipality)infoBack.href="index.html?kommun="+encodeURIComponent(municipality);
for(const id of ["accountBack","infoLink"]){const el=document.getElementById(id);if(el)el.href=withContext("foreningar-konto.html")}
const card=document.getElementById("associationAuthCard"),login=document.getElementById("associationLogin"),registration=document.getElementById("associationRegistration");
function showRegister(){card.classList.add("is-flipped");login.setAttribute("aria-hidden","true");login.inert=true;registration.removeAttribute("aria-hidden");registration.inert=false;history.replaceState(null,"",withContext("foreningskonto.html","register"))}
function showLogin(){card.classList.remove("is-flipped");registration.setAttribute("aria-hidden","true");registration.inert=true;login.removeAttribute("aria-hidden");login.inert=false;history.replaceState(null,"",withContext("foreningskonto.html"))}
document.getElementById("showAssociationRegistration")?.addEventListener("click",showRegister);document.getElementById("showAssociationLogin")?.addEventListener("click",showLogin);
if(params.get("mode")==="register")showRegister();if(association){const input=document.getElementById("associationSearch");if(input)input.value=association.replaceAll("-"," ")}
document.querySelectorAll("form").forEach(form=>form.addEventListener("submit",event=>{event.preventDefault();const message=form.querySelector(".form-message");message.hidden=false;message.textContent=form.id==="associationLoginForm"?"Föreningskontots inloggning aktiveras i nästa etapp.":"Registrering och verifiering aktiveras i nästa etapp."}));
