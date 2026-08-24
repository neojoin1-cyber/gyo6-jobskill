package com.gyo6.jobskill;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(Gyo6InAppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
