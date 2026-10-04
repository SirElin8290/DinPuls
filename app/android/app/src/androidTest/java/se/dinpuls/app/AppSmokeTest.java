package se.dinpuls.app;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private MainActivity main;
    private String evaluate(ActivityScenario<MainActivity> activity, String js) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        main.runOnUiThread(() -> main.getBridge().getWebView().evaluateJavascript(js, value -> {
            result.set(value); done.countDown();
        }));
        assertTrue("JavaScript svarade inte", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void awaitTrue(ActivityScenario<MainActivity> app, String js) throws Exception {
        for (int i=0;i<90;i++) {
            if ("true".equals(evaluate(app, js))) return;
            Thread.sleep(1000);
        }
        fail("Villkoret uppfylldes inte: " + js + "; " + evaluate(app,"JSON.stringify(window.appSmoke)+document.body.innerText.slice(0,1000)"));
    }
    private void screenshot(String name) { System.out.println("DinPuls QA: "+name); }
    @Test public void localPagesLiveDataAndNavigation() throws Exception {
        try (ActivityScenario<MainActivity> app = ActivityScenario.launch(MainActivity.class)) {
            app.onActivity(activity -> main=activity);
            awaitTrue(app,"!!document.querySelector('.app-navigation')");
            assertEquals("\"localhost\"",evaluate(app,"location.hostname"));
            screenshot("home");
            assertEquals("4",evaluate(app,"document.querySelectorAll('.app-navigation a').length"));
            evaluate(app,"window.appSmoke={}; Promise.all([fetch('data/municipalities.json').then(r=>r.json()),fetch('data/lunch.json').then(r=>r.json()),fetch('https://dinpuls-push.soren-johansson-7.workers.dev/health').then(r=>r.json())]).then(([m,l,h])=>{appSmoke.municipalities=m.municipalities.length;appSmoke.lunch=Object.values(l.municipalities).reduce((n,v)=>n+(v.restaurants||[]).length,0);appSmoke.backend=h.ok;}).catch(e=>appSmoke.error=String(e));");
            awaitTrue(app,"appSmoke.municipalities===21 && appSmoke.lunch>0 && appSmoke.backend===true");
            evaluate(app,"localStorage.setItem('dinpuls-municipality','Åmål');document.querySelector('.app-navigation a[href*=\"lunch.html\"]').click();");
            awaitTrue(app,"location.pathname==='/lunch.html' && !!document.querySelector('.app-navigation')");
            assertEquals("\"Åmål\"",evaluate(app,"localStorage.getItem('dinpuls-municipality')"));
            screenshot("lunch");
            for(String page:new String[]{"evenemang.html","foreningsliv.html","skola-familj.html","praktiskt.html","kris-beredskap.html"}){
                evaluate(app,"location.href='/"+page+"?kommun="+java.net.URLEncoder.encode("Åmål","UTF-8")+"';");
                awaitTrue(app,"location.pathname==='/"+page+"' && !!document.querySelector('.app-navigation')");
                screenshot(page.replace(".html",""));
            }
            evaluate(app,"location.href='/foretag/start.html';");
            awaitTrue(app,"location.pathname==='/foretag/start.html' && !!document.querySelector('input[type=password]')");
            awaitTrue(app,"!document.querySelector('#registrationForm').hidden");
            evaluate(app,"document.querySelector('#showRegistration').click();");
            awaitTrue(app,"document.querySelector('#authCard').classList.contains('is-flipped') && !document.querySelector('#registrationPanel').inert");
            screenshot("company-registration");
            evaluate(app,"document.querySelector('#showLogin').click();");
            awaitTrue(app,"!document.querySelector('#authCard').classList.contains('is-flipped') && !document.querySelector('#loginPanel').inert");
            screenshot("login");
            org.json.JSONArray point=new org.json.JSONArray(evaluate(app,"(()=>{const r=document.querySelector('input[type=password]').getBoundingClientRect();return [(r.x+r.width/2)*devicePixelRatio,(r.y+r.height/2)*devicePixelRatio];})()"));
            float x=(float)point.getDouble(0), y=(float)point.getDouble(1);
            main.runOnUiThread(()->{long now=android.os.SystemClock.uptimeMillis();android.view.MotionEvent down=android.view.MotionEvent.obtain(now,now,android.view.MotionEvent.ACTION_DOWN,x,y,0);android.view.MotionEvent up=android.view.MotionEvent.obtain(now,now+100,android.view.MotionEvent.ACTION_UP,x,y,0);main.getBridge().getWebView().dispatchTouchEvent(down);main.getBridge().getWebView().dispatchTouchEvent(up);down.recycle();up.recycle();});
            awaitTrue(app,"document.documentElement.classList.contains('app-keyboard-open')");
            screenshot("login-keyboard");
            main.runOnUiThread(()->{android.view.inputmethod.InputMethodManager keyboard=(android.view.inputmethod.InputMethodManager)main.getSystemService(android.content.Context.INPUT_METHOD_SERVICE);keyboard.hideSoftInputFromWindow(main.getBridge().getWebView().getWindowToken(),0);});
            awaitTrue(app,"!document.documentElement.classList.contains('app-keyboard-open')");
            main.runOnUiThread(()->{android.content.Intent link=new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("dinpuls://app/lunch.html?kommun=Kil"));link.setPackage("se.dinpuls.app");main.startActivity(link);});
            awaitTrue(app,"location.pathname==='/lunch.html' && new URLSearchParams(location.search).get('kommun')==='Kil'");
            screenshot("app-link-kil");
        }
    }
    private void launchWithoutWaitingForWebViewIdle() throws Exception {
        CountDownLatch resumed=new CountDownLatch(1);
        android.app.Application application=(android.app.Application)androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        android.app.Application.ActivityLifecycleCallbacks callback=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityResumed(android.app.Activity activity){if(activity instanceof MainActivity){main=(MainActivity)activity;resumed.countDown();}}
            public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}
            public void onActivityStarted(android.app.Activity a){}
            public void onActivityPaused(android.app.Activity a){}
            public void onActivityStopped(android.app.Activity a){}
            public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}
            public void onActivityDestroyed(android.app.Activity a){}
        };
        application.registerActivityLifecycleCallbacks(callback);
        try{
            android.content.Intent intent=new android.content.Intent(application,MainActivity.class);
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            application.startActivity(intent);
            assertTrue("Appen startade inte",resumed.await(20,TimeUnit.SECONDS));
        }finally{application.unregisterActivityLifecycleCallbacks(callback);}
    }
    private void closeWithoutWaitingForWebViewIdle() throws Exception {
        CountDownLatch finished=new CountDownLatch(1);
        main.runOnUiThread(()->{main.finish();finished.countDown();});
        assertTrue("Appen stängdes inte",finished.await(10,TimeUnit.SECONDS));
        Thread.sleep(1000);
    }
    @Test public void moduleChoicesPersistAfterAppRestart() throws Exception {
        String hidden="[...document.querySelectorAll('[data-home-module]')].every(c=>!c.checked && HOME_OPTIONAL_MODULES[c.dataset.homeModule].some(selector=>document.querySelector(selector)) && HOME_OPTIONAL_MODULES[c.dataset.homeModule].every(selector=>[...document.querySelectorAll(selector)].every(el=>el.hidden&&getComputedStyle(el).display==='none')))";
        launchWithoutWaitingForWebViewIdle();
        ActivityScenario<MainActivity> app=null;
        try{
            awaitTrue(app,"!!document.querySelector('.app-navigation')");
            evaluate(app,"localStorage.setItem('dinpuls-municipality','Åmål');location.href='/index.html?kommun='+encodeURIComponent('Åmål');");
            awaitTrue(app,"!!document.querySelector('#homepage-customize-button') && typeof HOME_OPTIONAL_MODULES!=='undefined' && !!document.querySelector('.sport-home')");
            awaitTrue(app,"(()=>{document.querySelector('#homepage-customize-button')?.click();return !!document.querySelector('#homepage-customize-dialog')?.open;})()");
            awaitTrue(app,"!!window.DinPulsNativePush && !!document.querySelector('#push-status')?.dataset.state");
            evaluate(app,"document.querySelector('#homepage-customize-button').click();document.querySelector('#homepage-customize-reset').click();for(const c of document.querySelectorAll('[data-home-module]'))if(c.checked)c.click();");
            awaitTrue(app,hidden);
            assertEquals("true",evaluate(app,"JSON.parse(localStorage.getItem('dinpuls-home-modules-v1')).hidden.length===document.querySelectorAll('[data-home-module]').length"));
            evaluate(app,"document.querySelector('#homepage-customize-dialog').close();");
        }finally{closeWithoutWaitingForWebViewIdle();}
        launchWithoutWaitingForWebViewIdle();
        try{
            awaitTrue(app,"!!document.querySelector('.sport-home') && typeof HOME_OPTIONAL_MODULES!=='undefined'");
            awaitTrue(app,hidden);
            evaluate(app,"document.querySelector('#homepage-customize-button').click();document.querySelector('#homepage-customize-reset').click();");
            awaitTrue(app,"[...document.querySelectorAll('[data-home-module]')].every(c=>c.checked)");
            assertEquals("[]",evaluate(app,"JSON.parse(localStorage.getItem('dinpuls-home-modules-v1')).hidden"));
        }finally{closeWithoutWaitingForWebViewIdle();}
    }

    @Test public void isolatedAccountPurchaseBannerChain() throws Exception {
        launchWithoutWaitingForWebViewIdle();
        ActivityScenario<MainActivity> app=null;
        try {
            evaluate(app,"sessionStorage.setItem('dp-isolated-e2e','true');sessionStorage.removeItem('dp-company-session');location.href='/foretag/start.html';");
            awaitTrue(app,"!!document.querySelector('#registrationForm') && !document.querySelector('#registrationForm').hidden");
            evaluate(app,"document.querySelector('#showRegistration').click();const f=document.querySelector('#registrationForm');const d={orgNo:'5561234567',company:'ISOLATED ANDROID TEST',address:'Testgatan 1',postalCode:'66230',city:'Åmål',contact:'CI Test',phone:'0701234567',email:'android@example.invalid'};for(const [k,v] of Object.entries(d))f.elements[k].value=v;f.requestSubmit();");
            awaitTrue(app,"document.querySelector('#registrationResult').textContent.includes('aktiverings') && !document.querySelector('#registrationResult').textContent.includes('misslyck')");
            evaluate(app,"fetch('http://127.0.0.1:8788/__test/mail').then(r=>r.json()).then(d=>{const link=d.messages[0].text.match(/#token=[a-f0-9]+&purpose=activate-account/)[0];sessionStorage.setItem('ci-activation',link);location.href='/foretag/konto.html?mail=reset'+link;});");
            awaitTrue(app,"!!document.querySelector('#passwordForm') && !document.querySelector('#passwordForm').hidden");
            evaluate(app,"document.querySelector('#newPassword').value='Android-Test-2026!';document.querySelector('#confirmPassword').value='Android-Test-2026!';document.querySelector('#passwordForm').requestSubmit();");
            awaitTrue(app,"!!document.querySelector('#statusView') && !document.querySelector('#statusView').hidden && document.querySelector('#statusTitle').textContent==='Klart!'");
            evaluate(app,"location.href='/foretag/start.html';");
            awaitTrue(app,"!!document.querySelector('#companyEntryLogin') && !document.querySelector('#registrationForm').hidden");
            evaluate(app,"document.querySelector('#loginEmail').value='android@example.invalid';document.querySelector('#companyEntryLogin [name=password]').value='Android-Test-2026!';document.querySelector('#companyEntryLogin').requestSubmit();");
            awaitTrue(app,"!!document.querySelector('#appView') && !document.querySelector('#appView').hidden");
            assertEquals("false",evaluate(app,"window.__e2eLoginFlash"));
            evaluate(app,"sessionStorage.setItem('ci-old-session',sessionStorage.getItem('dp-company-session'));location.href='/foretag/konto.html';");
            awaitTrue(app,"!!document.querySelector('#resetRequestForm') && !document.querySelector('#resetRequestForm').hidden");
            evaluate(app,"document.querySelector('#resetEmail').value='android@example.invalid';document.querySelector('#resetRequestForm').requestSubmit(document.querySelector('#resetRequestForm button'));");
            awaitTrue(app,"!document.querySelector('#resetMessage').hidden");
            evaluate(app,"fetch('http://127.0.0.1:8788/__test/mail').then(r=>r.json()).then(d=>{const link=d.messages.at(-1).text.match(/#token=[a-f0-9]+&purpose=reset-password/)[0];location.href='/foretag/konto.html?mail=reset'+link;});");
            awaitTrue(app,"!!document.querySelector('#passwordForm') && !document.querySelector('#passwordForm').hidden");
            evaluate(app,"document.querySelector('#newPassword').value='Android-New-Test-2026!';document.querySelector('#confirmPassword').value='Android-New-Test-2026!';document.querySelector('#passwordForm').requestSubmit();");
            awaitTrue(app,"document.querySelector('#statusTitle').textContent==='Klart!'");
            evaluate(app,"fetch('http://127.0.0.1:8788/portal/company/me',{headers:{Authorization:'Bearer '+sessionStorage.getItem('ci-old-session')}}).then(r=>window.ciOldStatus=r.status);");
            awaitTrue(app,"window.ciOldStatus===401");
            evaluate(app,"sessionStorage.removeItem('dp-company-session');location.href='/foretag/start.html';");
            awaitTrue(app,"!!document.querySelector('#companyEntryLogin') && !document.querySelector('#registrationForm').hidden");
            evaluate(app,"document.querySelector('#loginEmail').value='android@example.invalid';document.querySelector('#companyEntryLogin [name=password]').value='Android-New-Test-2026!';document.querySelector('#companyEntryLogin').requestSubmit();");
            awaitTrue(app,"!!document.querySelector('#appView') && !document.querySelector('#appView').hidden");
            for(String view:new String[]{"overview","banners","purchases","contract","profile"}) {
                evaluate(app,"document.querySelector('[data-view=\""+view+"\"]')?.click();");
                awaitTrue(app,"!document.querySelector('#"+view+"').hidden");
            }
            evaluate(app,"location.href='/foretag/kop.html';");
            awaitTrue(app,"!!document.querySelector('#buyApp') && !document.querySelector('#buyApp').hidden");
            evaluate(app,"document.querySelector('#buyMunicipality').value='Åmål';document.querySelector('#findSlots').click();");
            awaitTrue(app,"document.querySelectorAll('[data-add]').length>0");
            evaluate(app,"document.querySelector('[data-add]').click();document.querySelector('#prepareOrder').click();");
            awaitTrue(app,"document.querySelector('#orderDialog').open && !document.querySelector('#dinpulsFixedSignature').hidden");
            evaluate(app,"document.querySelector('#signerName').value='CI Test';document.querySelector('#signerTitle').value='Test';const c=document.querySelector('#signaturePad');const r=c.getBoundingClientRect();c.setPointerCapture=()=>{};for(const [type,x,y] of [['pointerdown',25,35],['pointermove',70,55],['pointerup',100,35]])c.dispatchEvent(new PointerEvent(type,{clientX:r.x+x,clientY:r.y+y,bubbles:true,pointerId:1,buttons:type==='pointerup'?0:1}));document.querySelector('#confirmTerms').click();document.querySelector('#confirmOrder').click();");
            awaitTrue(app,"!!document.querySelector('#confirmationMessage a') && document.querySelector('#confirmationMessage').textContent.includes('är låst')");
            evaluate(app,"document.querySelector('#confirmationMessage a').click();");
            awaitTrue(app,"location.pathname==='/foretag/index.html'");
            awaitTrue(app,"!!document.querySelector('#appView') && !document.querySelector('#appView').hidden");
            evaluate(app,"fetch('http://127.0.0.1:8788/portal/company/me',{headers:{Authorization:'Bearer '+sessionStorage.getItem('dp-company-session')}}).then(r=>r.json()).then(d=>fetch('http://127.0.0.1:8788/portal/company/contracts/'+d.contract.id+'/pdf',{headers:{Authorization:'Bearer '+sessionStorage.getItem('dp-company-session')}})).then(r=>r.blob()).then(b=>window.DinPulsNativeFiles.savePdf(b,'ci-contract.pdf',{share:false})).then(uri=>window.ciPdf=uri).catch(e=>window.ciPdfError=e.message);");
            awaitTrue(app,"typeof window.ciPdf==='string' && window.ciPdf.includes('ci-contract.pdf')");
            evaluate(app,"document.querySelector('[data-view=banners]').click();fetch('http://127.0.0.1:8788/__test/banner').then(r=>r.blob()).then(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'existing-test-fixture.webp',{type:'image/webp'}));const input=document.querySelector('#bannerUpload');input.files=dt.files;input.dispatchEvent(new Event('change'));document.querySelector('#bannerStart').value=new Date(Date.now()-60000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);document.querySelector('#bannerStart').dispatchEvent(new Event('input'));document.querySelector('#bannerLink').value='https://dinpuls.se/information.html';});");
            awaitTrue(app,"!document.querySelector('#saveBanner').disabled");
            evaluate(app,"document.querySelector('#saveBanner').click();");
            awaitTrue(app,"document.querySelector('#bannerSchedule').textContent.includes('existing-test-fixture')");
            assertEquals("[]",evaluate(app,"window.__e2eAlerts"));
            evaluate(app,"fetch('http://127.0.0.1:8788/__test/approve',{method:'POST'}).then(r=>r.json()).then(d=>{window.ciApproved=d.count;});");
            awaitTrue(app,"window.ciApproved===1");
            evaluate(app,"fetch('http://127.0.0.1:8788/__test/mail').then(r=>r.json()).then(d=>{window.ciMailCount=d.messages.length;});");
            awaitTrue(app,"window.ciMailCount>=3");
            evaluate(app,"localStorage.setItem('dinpuls-municipality','Åmål');location.href='/index.html?kommun='+encodeURIComponent('Åmål');");
            awaitTrue(app,"!!document.querySelector('.scheduled-public-ad img') && document.querySelector('.scheduled-public-ad img').complete && document.querySelector('.scheduled-public-ad img').naturalWidth>0");
            evaluate(app,"document.querySelector('.scheduled-public-ad img').scrollIntoView({block:'center'});");
            Thread.sleep(700);
            android.graphics.Bitmap shot=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            android.content.ContentValues values=new android.content.ContentValues();values.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME,"isolated-public-ad.png");values.put(android.provider.MediaStore.Images.Media.MIME_TYPE,"image/png");values.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH,"Pictures/DinPulsCI");
            android.net.Uri shotUri=main.getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
            assertNotNull(shotUri);try(java.io.OutputStream output=main.getContentResolver().openOutputStream(shotUri)){assertTrue(shot.compress(android.graphics.Bitmap.CompressFormat.PNG,100,output));}shot.recycle();
            assertEquals("true",evaluate(app,"document.documentElement.scrollWidth<=innerWidth"));
            assertEquals("true",evaluate(app,"(()=>{const r=document.querySelector('.scheduled-public-ad img').getBoundingClientRect();return r.width>0 && r.width<=innerWidth;})()"));
            System.out.println("DinPuls E2E PASS: real Android UI, isolated registration/password/login/purchase/signature/upload/moderation/public ad; captured mail, no real delivery.");
            evaluate(app,"sessionStorage.removeItem('dp-isolated-e2e');sessionStorage.removeItem('dp-company-session');");
        } finally {closeWithoutWaitingForWebViewIdle();}
    }

}
