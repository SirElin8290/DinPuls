package se.dinpuls.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
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
