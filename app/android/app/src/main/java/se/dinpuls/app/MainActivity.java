package se.dinpuls.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        reserveSystemBarSpace();
        openPackagedLink(getIntent());
    }
    private void reserveSystemBarSpace() {
        android.view.View decor=getWindow().getDecorView();
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        decor.setBackgroundColor(android.graphics.Color.BLACK);
        androidx.core.view.WindowInsetsControllerCompat controller=androidx.core.view.WindowCompat.getInsetsController(getWindow(),decor);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(decor,(view,insets)->{
            int types=androidx.core.view.WindowInsetsCompat.Type.systemBars()|androidx.core.view.WindowInsetsCompat.Type.displayCutout();
            androidx.core.graphics.Insets bars=insets.getInsets(types);
            int bottom=insets.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime())?insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime()).bottom:bars.bottom;
            view.setPadding(bars.left,bars.top,bars.right,bottom);
            // WebView-innehåll, även fasta element, ligger helt utanför systemraden.
            return new androidx.core.view.WindowInsetsCompat.Builder(insets).setInsets(types,androidx.core.graphics.Insets.NONE).build();
        });
        androidx.core.view.ViewCompat.requestApplyInsets(decor);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openPackagedLink(intent);
    }
    private void openPackagedLink(Intent intent) {
        if(intent==null)return;
        Uri uri=intent.getData();
        if(uri==null||!"dinpuls".equals(uri.getScheme())||!"app".equals(uri.getHost()))return;
        String path=uri.getPath();
        if(path==null||!path.matches("/(?:[a-z0-9-]+/)*[a-z0-9-]+\\.html"))return;
        // Endast en faktiskt paketerad publik HTML-sida får öppnas.
        try(java.io.InputStream page=getAssets().open("public"+path)) {
            String target=bridge.getScheme()+"://"+bridge.getHost()+path;
            if(uri.getEncodedQuery()!=null)target+="?"+uri.getEncodedQuery();
            if(uri.getEncodedFragment()!=null)target+="#"+uri.getEncodedFragment();
            bridge.getWebView().loadUrl(target);
        }catch(java.io.IOException ignored) { }
    }
}
