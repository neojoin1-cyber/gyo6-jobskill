package com.gyo6.jobskill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class ReleaseRecoveryInstrumentedTest {
    // GitHub's software-rendered API 36 emulator can need well over 25 seconds
    // for the first packaged WebView paint even though real devices are faster.
    private static final long WAIT_SECONDS = 90L;

    @Test
    public void localStorageSurvivesActivityRestart() throws Exception {
        String marker = "release-android-" + System.currentTimeMillis();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForWebApp(scenario);
            assertEquals("\"" + marker + "\"", evaluate(
                scenario,
                "localStorage.setItem('release.android.recovery', '" + marker + "');" +
                    "localStorage.getItem('release.android.recovery')"
            ));

            scenario.recreate();
            waitForWebApp(scenario);
            assertEquals("\"" + marker + "\"", evaluate(
                scenario,
                "localStorage.getItem('release.android.recovery')"
            ));
        }
    }

    private void waitForWebApp(ActivityScenario<MainActivity> scenario) throws Exception {
        long deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(WAIT_SECONDS);
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate(scenario, "Boolean(window.__SUGAR_SALT_NATIVE_READY__)"))) return;
            Thread.sleep(300L);
        }
        assertTrue("네이티브 학습 화면이 준비되지 않았습니다.", false);
    }

    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            webView.evaluateJavascript(script, value -> {
                result.set(value);
                latch.countDown();
            });
        });
        assertTrue("WebView 응답 시간이 초과됐습니다.", latch.await(WAIT_SECONDS, TimeUnit.SECONDS));
        return result.get();
    }
}
