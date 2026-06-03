package uk.ac.uea.ladywood;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
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
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

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
    private static final UUID DATA_CHAR_UUID = UUID.fromString("848cb058-7689-4b50-b207-92c33e6e630d");
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static final int MANUFACTURER_ID = 0xFFFF;
    private static final String ENVELOPE_FILE = "envelope.json";

    private BluetoothGattServer gattServer;
    private BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback advertiseCallback;

    private final AtomicInteger activeStreams = new AtomicInteger(0);

    private static final long STREAM_GRACE_MS = 5000;
    private volatile long lastStreamMs = 0;

    private volatile int negotiatedMtu = 23;

    private final Semaphore notifySlot = new Semaphore(0);

    private final Object cacheLock = new Object();
    private String cachedKey;
    private byte[] cachedBytes;

    private final Object envelopeLock = new Object();
    private long envelopeStamp = Long.MIN_VALUE;
    private Set<String> validHashes = Collections.emptySet();

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                negotiatedMtu = 23;
                notifySlot.release();
            }
            Log.d(TAG, "Connection state changed (state=" + newState + ").");
        }

        @Override
        public void onMtuChanged(BluetoothDevice device, int mtu) {
            negotiatedMtu = mtu;
            Log.d(TAG, "MTU negotiated: " + mtu);
        }

        @Override
        public void onNotificationSent(BluetoothDevice device, int status) {
            notifySlot.release();
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor,
                boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!hasConnectPermission())
                    return;
            }
            if (CCCD_UUID.equals(descriptor.getUuid())) {
                respond(device, requestId, responseNeeded, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattCharacteristic characteristic,
                boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!hasConnectPermission()) {
                    respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
                    return;
                }
            }

            if (DATA_CHAR_UUID.equals(characteristic.getUuid())) {
                String payload = value == null ? "" : new String(value, StandardCharsets.UTF_8);
                try {
                    if (payload.startsWith("DAT|") || payload.startsWith("ENV|")) {
                        final boolean isEnvelope = payload.startsWith("ENV|");
                        final String[] parts = payload.split("\\|");
                        final String hash = isEnvelope ? "" : (parts.length > 1 ? parts[1] : "");

                        if (!isEnvelope && !isKnownHash(hash)) {
                            Log.w(TAG, "Rejected stream request for unknown hash: " + hash);
                            respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
                            return;
                        }

                        respond(device, requestId, responseNeeded, BluetoothGatt.GATT_SUCCESS, offset, value);

                        activeStreams.incrementAndGet();
                        lastStreamMs = SystemClock.elapsedRealtime();
                        new Thread(() -> streamFile(device, characteristic, isEnvelope, hash)).start();
                        return;
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to parse stream request", e);
                }
            }
            respond(device, requestId, responseNeeded, BluetoothGatt.GATT_FAILURE, offset, null);
        }
    };

    @PluginMethod
    public void isServerBusy(PluginCall call) {
        boolean busy = activeStreams.get() > 0
                || (SystemClock.elapsedRealtime() - lastStreamMs) < STREAM_GRACE_MS;
        JSObject ret = new JSObject();
        ret.put("busy", busy);
        call.resolve(ret);
    }

    private void streamFile(BluetoothDevice device, BluetoothGattCharacteristic characteristic, boolean isEnvelope,
            String hash) {
        try {
            byte[] fileBytes = loadForRead(isEnvelope, hash);
            int chunkSize = Math.max(20, Math.min(negotiatedMtu - 3, 512));
            if (fileBytes != null) {
                int chunkOffset = 0;
                while (chunkOffset < fileBytes.length) {
                    int length = Math.min(fileBytes.length - chunkOffset, chunkSize);
                    byte[] chunk = new byte[length];
                    System.arraycopy(fileBytes, chunkOffset, chunk, 0, length);
                    if (!sendNotification(device, characteristic, chunk))
                        return;
                    chunkOffset += length;
                }
            }
            sendNotification(device, characteristic, "EOF".getBytes(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            lastStreamMs = SystemClock.elapsedRealtime();
            activeStreams.decrementAndGet();
        }
    }

    private boolean sendNotification(BluetoothDevice device, BluetoothGattCharacteristic characteristic, byte[] value)
            throws InterruptedException {
        BluetoothGattServer server = gattServer;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (server == null || !hasConnectPermission())
                return false;
        }

        notifySlot.drainPermits();
        characteristic.setValue(value);

        boolean queued;
        try {
            queued = server.notifyCharacteristicChanged(device, characteristic, false);
            if (!queued) {
                Thread.sleep(20);
                queued = server.notifyCharacteristicChanged(device, characteristic, false);
            }
        } catch (SecurityException e) {
            return false;
        }
        if (!queued)
            return false;

        return notifySlot.tryAcquire(2, TimeUnit.SECONDS);
    }

    @Nullable
    private byte[] loadForRead(boolean isEnvelope, String hash) {
        final String key;
        final File file;

        if (isEnvelope) {
            key = "envelope";
            file = new File(getContext().getFilesDir(), ENVELOPE_FILE);
        } else {
            key = "data:" + hash;
            file = new File(getContext().getFilesDir(), "json_data/" + hash + ".json");
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
                validHashes = parseEnvelopeHashes(readFileFully(envelope));
                envelopeStamp = stamp;
            }
            return validHashes;
        }
    }

    private static Set<String> parseEnvelopeHashes(@Nullable byte[] envelopeBytes) {
        if (envelopeBytes == null) {
            return Collections.emptySet();
        }
        try {
            JSONObject root = new JSONObject(new String(envelopeBytes, StandardCharsets.UTF_8));
            JSONArray datasets = root.optJSONArray("datasets");
            if (datasets == null) {
                return Collections.emptySet();
            }

            Set<String> hashes = new HashSet<>();
            for (int i = 0; i < datasets.length(); i++) {
                JSONObject dataset = datasets.optJSONObject(i);
                if (dataset == null) {
                    continue;
                }
                addIfSafe(hashes, dataset.optString("data", ""));

                Object translations = dataset.opt("translations");
                if (translations instanceof JSONObject) {
                    JSONObject map = (JSONObject) translations;
                    for (Iterator<String> keys = map.keys(); keys.hasNext();) {
                        addIfSafe(hashes, map.optString(keys.next(), ""));
                    }
                } else if (translations instanceof String) {
                    addIfSafe(hashes, (String) translations);
                }
            }
            return hashes;
        } catch (JSONException e) {
            Log.e(TAG, "Malformed " + ENVELOPE_FILE, e);
            return Collections.emptySet();
        }
    }

    private static void addIfSafe(Set<String> hashes, String value) {
        if (value != null && !value.isEmpty() && !value.contains("/") && !value.contains("\\")
                && !value.contains("..")) {
            hashes.add(value);
        }
    }

    @PluginMethod
    public void startBroadcasting(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasConnectPermission()) {
                call.reject("BLUETOOTH_CONNECT permission not granted");
                return;
            }
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
                    .addManufacturerData(MANUFACTURER_ID,
                            new byte[] { (byte) (version >>> 8), (byte) version })
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
            activeStreams.set(0);
            lastStreamMs = 0;
            negotiatedMtu = 23;
            notifySlot.drainPermits();
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

        BluetoothGattCharacteristic dataChar = getBluetoothGattCharacteristic();

        service.addCharacteristic(dataChar);
        return service;
    }

    @NonNull
    private static BluetoothGattCharacteristic getBluetoothGattCharacteristic() {
        BluetoothGattCharacteristic dataChar = new BluetoothGattCharacteristic(
                DATA_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_WRITE);

        BluetoothGattDescriptor cccd = new BluetoothGattDescriptor(
                CCCD_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE);
        dataChar.addDescriptor(cccd);
        return dataChar;
    }

    @RequiresApi(api = Build.VERSION_CODES.S)
    private boolean hasConnectPermission() {
        return ActivityCompat.checkSelfPermission(getContext(),
                Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void sendResponse(BluetoothDevice device, int requestId, int status, int offset, byte[] value) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (gattServer == null || !hasConnectPermission())
                return;
        }
        try {
            gattServer.sendResponse(device, requestId, status, offset, value);
        } catch (SecurityException e) {
            Log.e(TAG, "sendResponse failed", e);
        }
    }

    private void respond(BluetoothDevice device, int requestId, boolean responseNeeded, int status, int offset,
            byte[] value) {
        if (responseNeeded) {
            sendResponse(device, requestId, status, offset, value);
        }
    }
}