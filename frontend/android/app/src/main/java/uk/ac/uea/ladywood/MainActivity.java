package uk.ac.uea.ladywood;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LadywoodGatt.class);
        super.onCreate(savedInstanceState);
    }
}