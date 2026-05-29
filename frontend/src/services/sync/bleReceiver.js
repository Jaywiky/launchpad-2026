import { BleClient } from '@capacitor-community/bluetooth-le';

import { readJsonFile, writeJsonFile, commitFile } from '../storage/fileSystem';
import { BLE_CONFIG } from './bleConfig';

let localEnvelope = null;
let localVersion = null;
let isScanning = false;
let isConnecting = false;

export function getIsConnecting() {
    return isConnecting;
}

async function ensureLocalEnvelopeLoaded() {
    if (localVersion !== null) return;
    localEnvelope = (await readJsonFile('envelope.json')) || { version: 0, categories: {} };
    localVersion = localEnvelope.version ?? 0;
    console.log(`[Receiver] Local version: ${localVersion}`);
}

export async function startScanning() {
    if (isScanning) return;
    isScanning = true;

    try {
        await ensureLocalEnvelopeLoaded();
        await BleClient.requestLEScan({ services: [BLE_CONFIG.SERVICE_UUID] }, onDeviceFound);
    } catch (e) {
        isScanning = false;
        console.error('[Receiver] Scan error:', e);
    }
}

export async function stopScanning() {
    if (!isScanning) return;
    isScanning = false;
    try {
        await BleClient.stopLEScan();
        console.log('[Receiver] Scan stopped.');
    } catch (e) {
        console.error('[Receiver] Error stopping scan:', e);
    }
}

async function onDeviceFound(result) {
    if (isConnecting) return;

    const peerId = result.device?.deviceId;
    const peerVersion = parsePeerVersion(result);
    if (!peerId || peerVersion === null) return;

    console.log(`[Receiver] Peer ${peerId} version ${peerVersion} (local ${localVersion}).`);
    if (peerVersion <= localVersion) return;

    isConnecting = true;
    try {
        await stopScanning();
        await syncFromPeer(peerId);
    } catch (e) {
        console.error('[Receiver] Sync failed:', e);
    } finally {
        isConnecting = false;
    }
}

function parsePeerVersion(result) {
    const mfg = result.manufacturerData;
    if (!mfg) return null;

    const raw =
        mfg[BLE_CONFIG.MANUFACTURER_ID] ??
        mfg[String(BLE_CONFIG.MANUFACTURER_ID)] ??
        Object.values(mfg)[0];
    if (!raw) return null;

    if (raw instanceof DataView) {
        return raw.byteLength > 0 ? raw.getUint8(0) : null;
    }
    if (typeof raw === 'string') {
        const n = parseInt(raw, 16);
        return Number.isNaN(n) ? null : n;
    }
    return null;
}

async function syncFromPeer(peerId) {
    try {
        await BleClient.connect(peerId);
        console.log(`[Receiver] Connected to ${peerId}.`);

        const peerEnvelope = await readJson(peerId, BLE_CONFIG.ENVELOPE_UUID);
        if (!peerEnvelope || typeof peerEnvelope.categories !== 'object') {
            throw new Error('Peer envelope is missing a categories object');
        }

        await writeJsonFile('tmp/envelope.json', peerEnvelope);

        const downloadedHashes = [];
        for (const [category, hash] of Object.entries(peerEnvelope.categories)) {
            if (!hash || localEnvelope.categories?.[category] === hash) continue;

            console.log(`[Receiver] Fetching '${category}' (${hash}).`);
            await BleClient.write(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID, encodeText(hash));

            const jsonData = await readJson(peerId, BLE_CONFIG.DATA_UUID);
            await writeJsonFile(`tmp/${hash}.json`, jsonData);
            downloadedHashes.push(hash);
        }

        for (const hash of downloadedHashes) {
            await commitFile(`tmp/${hash}.json`, `json_data/${hash}.json`);
        }
        await commitFile('tmp/envelope.json', 'envelope.json');

        localEnvelope = peerEnvelope;
        localVersion = peerEnvelope.version ?? localVersion;
        window.dispatchEvent(new Event('meshSyncUpdated'));
        console.log(`[Receiver] Sync complete; ${downloadedHashes.length} file(s) updated.`);
    } finally {
        await safeDisconnect(peerId);
    }
}

async function readJson(peerId, characteristicUuid) {
    const view = await BleClient.read(peerId, BLE_CONFIG.SERVICE_UUID, characteristicUuid);
    return JSON.parse(new TextDecoder().decode(view));
}

function encodeText(text) {
    return new DataView(new TextEncoder().encode(text).buffer);
}

async function safeDisconnect(peerId) {
    try {
        await BleClient.disconnect(peerId);
    } catch (e) {
        console.warn('[Receiver] Disconnect error:', e);
    }
}