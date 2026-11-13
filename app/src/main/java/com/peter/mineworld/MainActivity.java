package com.peter.mineworld;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.JavascriptInterface;
import android.view.HapticFeedbackConstants;
import java.io.ByteArrayInputStream;

public final class MainActivity extends Activity {
    private WebView game;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(13,24,27));
        getWindow().setNavigationBarColor(Color.rgb(13,24,27));
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(13,24,27));
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setDomStorageEnabled(true);
        game.getSettings().setAllowFileAccess(true);
        game.getSettings().setAllowContentAccess(false);
        game.getSettings().setMediaPlaybackRequiresUserGesture(true);
        game.addJavascriptInterface(new Feedback(), "MineworldNative");
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/game/");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith("file:///android_asset/game/"))
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                return null;
            }
        });
        setContentView(game);
        game.loadUrl("file:///android_asset/game/index.html");
    }
    private final class Feedback {
        @JavascriptInterface public void tap() {
            runOnUiThread(() -> game.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP));
        }
    }
    @Override protected void onPause() {
        game.evaluateJavascript("window.MW && window.MW.suspend()", null);
        game.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (game != null) { game.onResume(); game.evaluateJavascript("window.MW && window.MW.resume()", null); }
    }
    @Override public void onBackPressed() {
        game.evaluateJavascript("window.MW && window.MW.back()", null);
    }
    @Override protected void onDestroy() {
        if (game != null) { game.removeJavascriptInterface("MineworldNative"); game.destroy(); }
        super.onDestroy();
    }
}
