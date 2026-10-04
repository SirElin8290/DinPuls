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
    @Test public void localPagesLiveDataAndNavigation() throws Exception {
        try (ActivityScenario<MainActivity> app = ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(app,"!!document.querySelector('.app-navigation')");
            assertEquals("\"localhost\"",evaluate(app,"location.hostname"));
            assertEquals("4",evaluate(app,"document.querySelectorAll('.app-navigation a').length"));
            evaluate(app,"window.appSmoke={}; Promise.all([fetch('data/municipalities.json').then(r=>r.json()),fetch('data/lunch.json').then(r=>r.json()),fetch('https://dinpuls-push.soren-johansson-7.workers.dev/health').then(r=>r.json())]).then(([m,l,h])=>{appSmoke.municipalities=m.municipalities.length;appSmoke.lunch=Object.values(l.municipalities).reduce((n,v)=>n+(v.restaurants||[]).length,0);appSmoke.backend=h.ok;}).catch(e=>appSmoke.error=String(e));");
            awaitTrue(app,"appSmoke.municipalities===21 && appSmoke.lunch>0 && appSmoke.backend===true");
            evaluate(app,"localStorage.setItem('dinpuls-municipality','Åmål');document.querySelector('.app-navigation a[href*=\"lunch.html\"]').click();");
            awaitTrue(app,"location.pathname==='/lunch.html' && !!document.querySelector('.app-navigation')");
            assertEquals("\"Åmål\"",evaluate(app,"localStorage.getItem('dinpuls-municipality')"));
            evaluate(app,"location.href='/foretag/start.html';");
            awaitTrue(app,"location.pathname==='/foretag/start.html' && !!document.querySelector('input[type=password]')");
        }
    }
}
