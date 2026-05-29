package uk.ac.uea.ladywood;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "LadywoodGatt", permissions = {
        @Permission(strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE
        }, alias = "bluetooth")
})
public class LadywoodGatt extends Plugin {

    private static final String TAG = "LadywoodGatt";

    private static final UUID SERVICE_UUID = UUID.fromString("f0bffd13-ad4e-4882-8fc7-cdfcabd00e73");
    private static final UUID ENVELOPE_CHAR_UUID = UUID.fromString("9ab41921-747a-42d7-89df-4164a2e64421");
    private static final UUID DATA_CHAR_UUID = UUID.fromString("848cb058-7689-4b50-b207-92c33e6e630d");
    private static final int MANUFACTURER_ID = 0xFFFF;
    private static final String ENVELOPE_FILE = "envelope.json";

    private BluetoothGattServer gattServer;
    private BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback advertiseCallback;

    private volatile String currentRequestedHash = "";

    private final Object cacheLock = new Object();
    private String cachedKey;
    private byte[] cachedBytes;

    private final Object envelopeLock = new Object();
    private long envelopeStamp = Long.MIN_VALUE;
    private Set<String> validHashes = Collections.emptySet();

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            Log.d(TAG, "Connection state changed: status=" + status + " newState=" + newState);
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattCharacteristic characteristic,
                boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            if (!hasConnectPermission()) {
                respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
                return;
            }

            if (DATA_CHAR_UUID.equals(characteristic.getUuid())) {
                String hash = value == null ? "" : new String(value, StandardCharsets.UTF_8);
                if (!isKnownHash(hash)) {
                    Log.w(TAG, "Rejected write for unknown hash");
                    respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
                    return;
                }
                currentRequestedHash = hash;
                respond(device, requestId, responseNeeded, BluetoothGatt.GATT_SUCCESS, offset, value);
            } else {
                respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
            }
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId,
                int offset, BluetoothGattCharacteristic characteristic) {
            if (!hasConnectPermission()) {
                sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, null);
                return;
            }

            byte[] fileBytes = loadForRead(characteristic.getUuid());
            if (fileBytes == null) {
                Log.w(TAG, "No data available for characteristic " + characteristic.getUuid());
                sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, new byte[0]);
                return;
            }

            if (offset < 0 || offset > fileBytes.length) {
                sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null);
                return;
            }

            byte[] chunk = new byte[fileBytes.length - offset];
            System.arraycopy(fileBytes, offset, chunk, 0, chunk.length);
            sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, chunk);
        }
    };

    @Nullable
    private byte[] loadForRead(UUID characteristicUuid) {
        final String key;
        final File file;

        if (DATA_CHAR_UUID.equals(characteristicUuid)) {
            String hash = currentRequestedHash;
            if (!isKnownHash(hash)) {
                Log.w(TAG, "No valid hash selected for data read");
                return null;
            }
            key = "data:" + hash;
            file = new File(getContext().getFilesDir(), "json_data/" + hash + ".json");
        } else if (ENVELOPE_CHAR_UUID.equals(characteristicUuid)) {
            key = "envelope";
            file = new File(getContext().getFilesDir(), ENVELOPE_FILE);
        } else {
            return null;
        }

        synchronized (cacheLock) {
            if (key.equals(cachedKey) && cachedBytes != null) {
                return cachedBytes;
            }
            byte[] bytes = readFileFully(file);
            cachedKey = bytes == null ? null : key;
            cachedBytes = bytes;
            return bytes;
        }
    }

    @Nullable
    private static byte[] readFileFully(File file) {
        if (!file.exists()) {
            return null;
        }
        byte[] bytes = new byte[(int) file.length()];
        try (DataInputStream in = new DataInputStream(new FileInputStream(file))) {
            in.readFully(bytes);
            return bytes;
        } catch (IOException e) {
            Log.e(TAG, "Failed to read " + file.getName(), e);
            return null;
        }
    }

    private boolean isKnownHash(String hash) {
        return hash != null && !hash.isEmpty() && currentValidHashes().contains(hash);
    }

    private Set<String> currentValidHashes() {
        File envelope = new File(getContext().getFilesDir(), ENVELOPE_FILE);
        synchronized (envelopeLock) {
            if (!envelope.exists()) {
                envelopeStamp = Long.MIN_VALUE;
                validHashes = Collections.emptySet();
                return validHashes;
            }
            long stamp = envelope.lastModified() * 31 + envelope.length();
            if (stamp != envelopeStamp) {
                validHashes = parseCategoryHashes(readFileFully(envelope));
                envelopeStamp = stamp;
            }
            return validHashes;
        }
    }

    private static Set<String> parseCategoryHashes(@Nullable byte[] envelopeBytes) {
        if (envelopeBytes == null) {
            return Collections.emptySet();
        }
        try {
            JSONObject categories = new JSONObject(new String(envelopeBytes, StandardCharsets.UTF_8))
                    .optJSONObject("categories");
            if (categories == null) {
                return Collections.emptySet();
            }
            Set<String> hashes = new HashSet<>();
            for (Iterator<String> keys = categories.keys(); keys.hasNext();) {
                String value = categories.optString(keys.next(), "");
                if (!value.isEmpty()
                        && !value.contains("/")
                        && !value.contains("\\")
                        && !value.contains("..")) {
                    hashes.add(value);
                }
            }
            return hashes;
        } catch (JSONException e) {
            Log.e(TAG, "Malformed " + ENVELOPE_FILE, e);
            return Collections.emptySet();
        }
    }

    @PluginMethod
    public void startBroadcasting(PluginCall call) {
        if (!hasConnectPermission()) {
            call.reject("BLUETOOTH_CONNECT permission not granted");
            return;
        }

        int version = call.getInt("version", 0);

        BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = bluetoothManager == null ? null : bluetoothManager.getAdapter();

        if (adapter == null || !adapter.isMultipleAdvertisementSupported()) {
            call.reject("BLE Peripheral not supported");
            return;
        }

        try {
            gattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);
            gattServer.addService(buildGattService());

            advertiser = adapter.getBluetoothLeAdvertiser();
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setConnectable(true)
                    .build();

            AdvertiseData data = new AdvertiseData.Builder()
                    .setIncludeDeviceName(false)
                    .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                    .addManufacturerData(MANUFACTURER_ID, new byte[] { (byte) version })
                    .build();

            advertiseCallback = new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    call.resolve();
                }

                @Override
                public void onStartFailure(int errorCode) {
                    call.reject("Advertising failed: " + errorCode);
                }
            };

            advertiser.startAdvertising(settings, data, advertiseCallback);
        } catch (SecurityException e) {
            call.reject("Missing permissions", e);
        }
    }

    @PluginMethod
    public void stopBroadcasting(PluginCall call) {
        try {
            if (advertiser != null && advertiseCallback != null) {
                advertiser.stopAdvertising(advertiseCallback);
            }
            if (gattServer != null) {
                gattServer.clearServices();
                gattServer.close();
            }
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Error stopping broadcast", e);
        } finally {
            advertiseCallback = null;
            advertiser = null;
            gattServer = null;
            synchronized (cacheLock) {
                cachedKey = null;
                cachedBytes = null;
            }
            synchronized (envelopeLock) {
                envelopeStamp = Long.MIN_VALUE;
                validHashes = Collections.emptySet();
            }
        }
    }

    @NonNull
    private static BluetoothGattService buildGattService() {
        BluetoothGattService service = new BluetoothGattService(SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY);

        service.addCharacteristic(new BluetoothGattCharacteristic(
                ENVELOPE_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ));

        service.addCharacteristic(new BluetoothGattCharacteristic(
                DATA_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_READ | BluetoothGattCharacteristic.PERMISSION_WRITE));

        return service;
    }

    private boolean hasConnectPermission() {
        return ActivityCompat.checkSelfPermission(getContext(),
                Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void sendResponse(BluetoothDevice device, int requestId, int status, int offset, byte[] value) {
        if (gattServer == null || !hasConnectPermission()) {
            return;
        }
        try {
            gattServer.sendResponse(device, requestId, status, offset, value);
        } catch (SecurityException e) {
            Log.e(TAG, "sendResponse failed", e);
        }
    }

    private void respond(BluetoothDevice device, int requestId, boolean responseNeeded,
            int status, int offset, byte[] value) {
        if (responseNeeded) {
            sendResponse(device, requestId, status, offset, value);
        }
    }
}