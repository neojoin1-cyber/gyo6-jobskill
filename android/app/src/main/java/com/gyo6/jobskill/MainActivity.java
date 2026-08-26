package com.gyo6.jobskill;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Gyo6BootGuard";
    private static final String PREFS = "gyo6_native_boot";
    private static final String LAST_BUILD = "last_recovered_build";
    private static final long BOOT_TIMEOUT_MS = 12000L;

    private final Handler bootHandler = new Handler(Looper.getMainLooper());
    private FrameLayout bootOverlay;
    private TextView bootMessage;
    private ProgressBar bootProgress;
    private LinearLayout recoveryActions;
    private boolean webAppReady = false;
    private boolean recoveryRunning = false;
    private boolean packageChangedAtBoot = false;
    private OnBackPressedCallback bootBackCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(Gyo6InAppUpdatePlugin.class);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long recoveredBuild = prefs.getLong(LAST_BUILD, -1L);
        packageChangedAtBoot = recoveredBuild != currentBuildCode();
        if (packageChangedAtBoot) {
            // This must happen before BridgeActivity creates WebView. Once the
            // old worker is active, unregistering it from page JavaScript does
            // not release the current controller soon enough for first boot.
            purgeLegacyWorkerStorage();
        }
        super.onCreate(savedInstanceState);
        installBootGuard();
        if (packageChangedAtBoot) {
            showBootLoading("업데이트된 학습 화면을 정리하고 있습니다.");
        }
        startReadyPolling();
    }

    private void installBootGuard() {
        FrameLayout content = findViewById(android.R.id.content);
        if (content == null) return;

        bootOverlay = new FrameLayout(this);
        bootOverlay.setBackgroundColor(Color.rgb(245, 247, 251));
        bootOverlay.setClickable(true);
        content.addView(bootOverlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        bootBackCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishAndRemoveTask();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, bootBackCallback);

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        int horizontal = dp(28);
        panel.setPadding(horizontal, dp(32), horizontal, dp(32));
        FrameLayout.LayoutParams panelParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        bootOverlay.addView(panel, panelParams);

        TextView mark = new TextView(this);
        mark.setText("S");
        mark.setTextColor(Color.WHITE);
        mark.setTextSize(25);
        mark.setGravity(Gravity.CENTER);
        mark.setBackgroundColor(Color.rgb(49, 93, 232));
        LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(dp(58), dp(58));
        markParams.bottomMargin = dp(18);
        panel.addView(mark, markParams);

        TextView title = new TextView(this);
        title.setText("설탕과소금");
        title.setTextColor(Color.rgb(23, 32, 51));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        panel.addView(title);

        bootMessage = new TextView(this);
        bootMessage.setText("업데이트된 학습 화면을 준비하고 있습니다.");
        bootMessage.setTextColor(Color.rgb(102, 112, 133));
        bootMessage.setTextSize(14);
        bootMessage.setGravity(Gravity.CENTER);
        bootMessage.setPadding(0, dp(10), 0, 0);
        panel.addView(bootMessage);

        bootProgress = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(42), dp(42));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        progressParams.topMargin = dp(24);
        panel.addView(bootProgress, progressParams);

        recoveryActions = new LinearLayout(this);
        recoveryActions.setOrientation(LinearLayout.VERTICAL);
        recoveryActions.setVisibility(View.GONE);
        LinearLayout.LayoutParams actionsParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        actionsParams.topMargin = dp(22);
        panel.addView(recoveryActions, actionsParams);

        Button retry = new Button(this);
        retry.setText("최신 화면 다시 받기");
        retry.setTextSize(16);
        retry.setAllCaps(false);
        retry.setOnClickListener(view -> recoverPackagedWebRuntime(false));
        recoveryActions.addView(retry, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(52)
        ));

        Button exit = new Button(this);
        exit.setText("앱 종료");
        exit.setTextSize(15);
        exit.setAllCaps(false);
        exit.setOnClickListener(view -> finishAndRemoveTask());
        LinearLayout.LayoutParams exitParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(50)
        );
        exitParams.topMargin = dp(8);
        recoveryActions.addView(exit, exitParams);

        bootHandler.postDelayed(this::showBootFailure, BOOT_TIMEOUT_MS);
    }

    private void recoverPackagedWebRuntime(boolean packageChanged) {
        if (recoveryRunning) return;
        recoveryRunning = true;
        showBootLoading(packageChanged
            ? "업데이트된 학습 화면을 정리하고 있습니다."
            : "최신 학습 화면을 다시 받고 있습니다.");

        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            recoveryRunning = false;
            bootHandler.postDelayed(() -> recoverPackagedWebRuntime(packageChanged), 250L);
            return;
        }

        long buildCode = currentBuildCode();
        String recoveryUrl = "https://localhost/?native_recover=" + buildCode;
        String cleanupScript = "(async()=>{try{" +
            "const r=await navigator.serviceWorker?.getRegistrations?.();" +
            "await Promise.all((r||[]).map(x=>x.unregister()));" +
            "const k=await caches?.keys?.();" +
            "await Promise.all((k||[]).map(x=>caches.delete(x)));" +
            "}catch(e){}finally{location.replace('" + recoveryUrl + "')}})()";

        webView.clearCache(true);
        webView.evaluateJavascript(cleanupScript, ignored -> {
            bootHandler.postDelayed(() -> {
                recoveryRunning = false;
                webView.loadUrl(recoveryUrl);
                startReadyPolling();
            }, 900L);
        });
    }

    private void startReadyPolling() {
        bootHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (webAppReady || isFinishing()) return;
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView == null) {
                    bootHandler.postDelayed(this, 250L);
                    return;
                }
                webView.evaluateJavascript(
                    "Boolean(window.__SUGAR_SALT_NATIVE_READY__)",
                    value -> {
                        if ("true".equals(value)) {
                            markWebAppReady();
                        } else if (!webAppReady) {
                            bootHandler.postDelayed(this, 300L);
                        }
                    }
                );
            }
        }, 250L);
    }

    private void markWebAppReady() {
        if (webAppReady) return;
        webAppReady = true;
        if (bootBackCallback != null) bootBackCallback.setEnabled(false);
        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putLong(LAST_BUILD, currentBuildCode())
            .apply();
        Log.i(TAG, "React app painted; native boot guard released");
        if (bootOverlay != null && bootOverlay.getParent() instanceof ViewGroup) {
            ((ViewGroup) bootOverlay.getParent()).removeView(bootOverlay);
        }
        bootOverlay = null;
    }

    private void showBootLoading(String message) {
        if (bootMessage != null) bootMessage.setText(message);
        if (bootProgress != null) bootProgress.setVisibility(View.VISIBLE);
        if (recoveryActions != null) recoveryActions.setVisibility(View.GONE);
    }

    private void showBootFailure() {
        if (webAppReady || bootOverlay == null) return;
        Log.e(TAG, "React app did not become ready before boot timeout");
        bootMessage.setText("학습 화면을 열지 못했습니다. 앱을 강제 종료하지 않고 여기서 복구할 수 있습니다.");
        bootProgress.setVisibility(View.GONE);
        recoveryActions.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private long currentBuildCode() {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return packageInfo.getLongVersionCode();
            }
            return packageInfo.versionCode;
        } catch (Exception error) {
            Log.e(TAG, "Unable to read package build code", error);
            return 0L;
        }
    }

    private void purgeLegacyWorkerStorage() {
        Log.i(TAG, "Package build changed; removing legacy worker storage before WebView boot");
        File worker = new File(getDataDir(), "app_webview/Default/Service Worker");
        File httpCache = new File(getCacheDir(), "WebView/Default/HTTP Cache");
        deleteRecursively(worker);
        deleteRecursively(httpCache);
    }

    private void deleteRecursively(File target) {
        if (target == null || !target.exists()) return;
        File[] children = target.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        if (!target.delete()) {
            Log.w(TAG, "Unable to delete stale WebView path: " + target.getAbsolutePath());
        }
    }

}
