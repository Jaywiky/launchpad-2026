import { BleClient } from '@capacitor-community/bluetooth-le'

import { BLE_CONFIG, TIMING } from './bleConfig'
import { loadLocalEnvelope, applyEnvelopeUpdate } from './syncEngine'

let isScanning = false
let isConnecting = false

export function getIsConnecting() { return isConnecting }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(label, fn) {
    let lastError
    for (let attempt = 1; attempt <= TIMING.GATT_RETRY_ATTEMPTS; attempt++) {
        try { return await fn() }
        catch (e) {
            lastError = e
            console.warn(`[Receiver] ${label} attempt ${attempt}/${TIMING.GATT_RETRY_ATTEMPTS} failed:`, e?.message || e)
            if (attempt < TIMING.GATT_RETRY_ATTEMPTS) await sleep(TIMING.GATT_RETRY_DELAY_MS)
        }
    }
    throw lastError
}

export async function startScanning() {
    if (isScanning) return
    isScanning = true

    try { await BleClient.requestLEScan({ services: [BLE_CONFIG.SERVICE_UUID] }, onDeviceFound) }
    catch (e) {
        isScanning = false
        console.error('[Receiver] Scan error:', e)
    }
}

export async function stopScanning() {
    if (!isScanning) return
    isScanning = false
    try {
        await BleClient.stopLEScan()
        console.log('[Receiver] Scan stopped.')
    } catch (e) {
        console.error('[Receiver] Error stopping scan:', e)
    }
}

async function onDeviceFound(result) {
    if (isConnecting) return

    const peerId = result.device?.deviceId
    const peerVersion = parsePeerVersion(result)
    if (!peerId || peerVersion === null) return

    isConnecting = true
    try {
        const localEnvelope = await loadLocalEnvelope()
        const localVersion = localEnvelope.version ?? 0

        console.log(`[Receiver] Peer ${peerId} version ${peerVersion} (local ${localVersion}).`)
        if (peerVersion <= localVersion) {
            isConnecting = false;
            return;
        }

        await stopScanning()
        await syncFromPeer(peerId, localEnvelope)
    } catch (e) {
        console.error('[Receiver] Sync failed:', e)
    } finally {
        isConnecting = false
    }
}

function parsePeerVersion(result) {
    const mfg = result.manufacturerData
    if (!mfg) return null

    const raw = mfg[BLE_CONFIG.MANUFACTURER_ID] ?? mfg[String(BLE_CONFIG.MANUFACTURER_ID)] ?? Object.values(mfg)[0]
    if (!raw) return null

    if (raw instanceof DataView) return raw.byteLength > 0 ? raw.getUint8(0) : null

    if (typeof raw === 'string') {
        const n = parseInt(raw, 16)
        return Number.isNaN(n) ? null : n
    }
    return null
}

async function syncFromPeer(peerId, localEnvelope) {
    try {
        await withRetry('connect', () => BleClient.connect(peerId))
        console.log(`[Receiver] Connected to ${peerId}.`)

        await sleep(TIMING.POST_CONNECT_SETTLE_MS )

        const peerEnvelopeString = await withRetry('read envelope', () => readLargeFile(peerId, true))
        const peerEnvelope = JSON.parse(peerEnvelopeString)

        await applyEnvelopeUpdate({
            source: 'Receiver',
            remoteEnvelope: peerEnvelope,
            localEnvelope,
            fetchBlob: async (hash) => JSON.stringify(JSON.parse(await withRetry('read data', () => readLargeFile(peerId, false, hash)))),
        })
    } finally {
        await safeDisconnect(peerId)
    }
}

async function readLargeFile(peerId, isEnvelope, hash = "") {
    return new Promise(async (resolve, reject) => {
        let completeData = new Uint8Array(0);
        let streamFinished = false;
        const requestPayload = isEnvelope ? `ENV|0` : `DAT|${hash}|0`;

        try {
            await BleClient.startNotifications(
                peerId,
                BLE_CONFIG.SERVICE_UUID,
                BLE_CONFIG.DATA_UUID,
                (chunkView) => {
                    const chunkArray = new Uint8Array(chunkView.buffer);

                    if (chunkArray.length === 3 && new TextDecoder().decode(chunkArray) === "EOF") {
                        if (!streamFinished) {
                            streamFinished = true;
                            BleClient.stopNotifications(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID).catch(() => { });
                            const decodedString = new TextDecoder().decode(completeData);
                            resolve(decodedString);
                        }
                        return;
                    }

                    const newBuffer = new Uint8Array(completeData.length + chunkArray.length);
                    newBuffer.set(completeData);
                    newBuffer.set(chunkArray, completeData.length);
                    completeData = newBuffer;
                }
            );

            await BleClient.write(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID, encodeText(requestPayload));

            setTimeout(() => {
                if (!streamFinished) {
                    streamFinished = true;
                    BleClient.stopNotifications(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID).catch(() => { });
                    reject(new Error("File stream timed out."));
                }
            }, 15000);

        } catch (err) {
            reject(err);
        }
    });
}

function encodeText(text) {
    return new DataView(new TextEncoder().encode(text).buffer)
}

async function safeDisconnect(peerId) {
    try { await BleClient.disconnect(peerId) }
    catch (e) { console.warn('[Receiver] Disconnect error:', e) }
}