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
    private String evaluate(ActivityScenario<MainActivity> activity, String js) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        activity.onActivity(app -> app.getBridge().getWebView().evaluateJavascript(js, value -> {
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
        fail("Villkoret uppfylldes inte: " + js + "; " + evaluate(app,"document.body.innerText.slice(0,1000)"));
    }
    private void screenshot(String name) throws Exception {
        android.graphics.Bitmap bitmap=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        java.io.File folder=new java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"qa");
        folder.mkdirs();
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(folder,name+".png"))){bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
        bitmap.recycle();
    }
    @Test public void localPagesLiveDataAndNavigation() throws Exception {
        try (ActivityScenario<MainActivity> app = ActivityScenario.launch(MainActivity.class)) {
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
            evaluate(app,"document.querySelector('input[type=password]').focus();");
            awaitTrue(app,"document.documentElement.classList.contains('app-keyboard-open')");
            screenshot("login-keyboard");
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 4").close();
            app.onActivity(activity->{android.content.Intent link=new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("dinpuls://app/lunch.html?kommun=Kil"));link.setPackage("se.dinpuls.app");activity.startActivity(link);});
            awaitTrue(app,"location.pathname==='/lunch.html' && new URLSearchParams(location.search).get('kommun')==='Kil'");
            screenshot("app-link-kil");
        }
    }
}
