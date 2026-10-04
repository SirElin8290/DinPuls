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
            awaitTrue(app,"document.querySelector('#push-status')?.dataset.state==='setup' && document.querySelector('#push-enable').disabled");
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

}
