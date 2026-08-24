package com.gyo6.jobskill;

import android.content.Intent;
import android.content.IntentSender;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "Gyo6InAppUpdate")
public class Gyo6InAppUpdatePlugin extends Plugin {
    private static final int UPDATE_REQUEST_CODE = 4711;
    private AppUpdateManager appUpdateManager;

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
    }

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                JSObject result = new JSObject();
                int availability = info.updateAvailability();
                result.put("available", availability == UpdateAvailability.UPDATE_AVAILABLE);
                result.put("updateAvailability", availability);
                result.put("availableVersionCode", info.availableVersionCode());
                result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
                result.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
                result.put("source", "google_play_in_app_update");
                call.resolve(result);
            })
            .addOnFailureListener(error -> {
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("source", "google_play_in_app_update");
                result.put("error", error.getMessage());
                call.resolve(result);
            });
    }

    @PluginMethod
    public void startImmediateUpdate(PluginCall call) {
        manager().getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                boolean canStart = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
                if (!canStart) {
                    JSObject result = new JSObject();
                    result.put("started", false);
                    result.put("reason", "no_immediate_update");
                    call.resolve(result);
                    return;
                }

                try {
                    manager().startUpdateFlowForResult(
                        info,
                        getActivity(),
                        AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                        UPDATE_REQUEST_CODE
                    );
                    JSObject result = new JSObject();
                    result.put("started", true);
                    call.resolve(result);
                } catch (IntentSender.SendIntentException error) {
                    JSObject result = new JSObject();
                    result.put("started", false);
                    result.put("error", error.getMessage());
                    call.resolve(result);
                }
            })
            .addOnFailureListener(error -> {
                JSObject result = new JSObject();
                result.put("started", false);
                result.put("error", error.getMessage());
                call.resolve(result);
            });
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        String packageName = getContext().getPackageName();
        boolean opened = false;
        try {
            Intent storeIntent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("market://details?id=" + packageName));
            storeIntent.setPackage("com.android.vending");
            storeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(storeIntent);
            opened = true;
        } catch (Exception storeError) {
            try {
                Intent webIntent = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + packageName));
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(webIntent);
                opened = true;
            } catch (Exception ignored) {
                // The web layer performs the final browser fallback.
            }
        }

        JSObject result = new JSObject();
        result.put("opened", opened);
        call.resolve(result);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (appUpdateManager == null) return;
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (info.updateAvailability() != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) return;
            try {
                appUpdateManager.startUpdateFlowForResult(
                    info,
                    getActivity(),
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                    UPDATE_REQUEST_CODE
                );
            } catch (IntentSender.SendIntentException ignored) {
                // Play can resume the update on the next foreground transition.
            }
        });
    }

    private AppUpdateManager manager() {
        if (appUpdateManager == null) {
            appUpdateManager = AppUpdateManagerFactory.create(getContext());
        }
        return appUpdateManager;
    }
}
