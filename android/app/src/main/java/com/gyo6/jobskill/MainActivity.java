package com.gyo6.jobskill;

import android.content.IntentSender;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "InAppUpdate";
    private static final int UPDATE_REQUEST_CODE = 100;
    private AppUpdateManager appUpdateManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appUpdateManager = AppUpdateManagerFactory.create(this);
        checkForUpdate();
    }

    private void checkForUpdate() {
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        this,
                        AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                        UPDATE_REQUEST_CODE
                    );
                } catch (IntentSender.SendIntentException e) {
                    Log.e(TAG, "업데이트 시작 실패", e);
                }
            }
        }).addOnFailureListener(e -> Log.w(TAG, "업데이트 확인 실패", e));
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appUpdateManager == null) return;
        // 백그라운드 다운로드 완료 후 앱 재진입 시 설치 완료
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (info.installStatus() == InstallStatus.DOWNLOADED) {
                appUpdateManager.completeUpdate();
            }
        });
    }
}
