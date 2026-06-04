import { BleClient } from '@capacitor-community/bluetooth-le'

import { BLE_CONFIG, TIMING } from './bleConfig'
import { loadLocalEnvelope, applyEnvelopeUpdate } from './syncEngine'
import { startP2PNetwork, stopP2PNetwork } from './bleManager'

let isScanning = false
let isConnecting = false

export function getIsConnecting() { return isConnecting }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(label, fn, reboot) {
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

    try { console.log("[Receiver] Starting Scan."); await BleClient.requestLEScan({ services: [BLE_CONFIG.SERVICE_UUID] }, onDeviceFound) }
    catch (e) {
        isScanning = false
        console.error('[Receiver] Scan error:', e)
    }
}

export async function stopScanning() {
    if (!isScanning) return
    isScanning = false
    try { await BleClient.stopLEScan(); console.log('[Receiver] Scan stopped.') }
    catch (e) { console.error('[Receiver] Error stopping scan:', e) }
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
        if (peerVersion <= localVersion) return

        await stopScanning()
        await syncFromPeer(peerId, localEnvelope)
    } catch (e) { console.error('[Receiver] Sync failed:', e?.message || e) }
    finally { isConnecting = false }
}

function parsePeerVersion(result) {
    const mfg = result.manufacturerData
    if (!mfg) return null

    const raw = mfg[BLE_CONFIG.MANUFACTURER_ID] ?? mfg[String(BLE_CONFIG.MANUFACTURER_ID)] ?? Object.values(mfg)[0]
    if (!raw) return null

    if (raw instanceof DataView) {
        if (raw.byteLength >= 2) return raw.getUint16(0)
        if (raw.byteLength === 1) return raw.getUint8(0)
        return null
    }
    if (typeof raw === 'string') {
        const n = parseInt(raw, 16)
        return Number.isNaN(n) ? null : n
    }
    return null
}

async function syncFromPeer(peerId, localEnvelope) {
    let pending = null
    let notifying = false

    const armTimeout = (entry) => {
        entry.timeoutId = setTimeout(() => {
            if (pending === entry) {
                pending = null
                entry.reject(new Error('Stream stalled (no data received).'))
            }
        }, TIMING.STREAM_INACTIVITY_MS)
    }

    const onChunk = (view) => {
        if (!pending) return
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice()

        if (bytes.length === 3 && new TextDecoder().decode(bytes) === 'EOF') {
            const p = pending
            pending = null
            clearTimeout(p.timeoutId)
            const merged = new Uint8Array(p.total)
            let off = 0
            for (const c of p.chunks) { merged.set(c, off); off += c.length }
            p.resolve(new TextDecoder().decode(merged))
            return
        }
        pending.chunks.push(bytes)
        pending.total += bytes.length
        clearTimeout(pending.timeoutId)
        armTimeout(pending)
    }

    const requestFile = (isEnvelope, hash = '') =>
        new Promise((resolve, reject) => {
            const payload = isEnvelope ? 'ENV|0' : `DAT|${hash}|0`
            const entry = { chunks: [], total: 0, resolve, reject, timeoutId: null }
            pending = entry
            armTimeout(entry)

            BleClient.write(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID, encodeText(payload)).catch((err) => {
                if (pending === entry) {
                    clearTimeout(entry.timeoutId)
                    pending = null
                    reject(err)
                }
            })
        })

    try {
        await safeDisconnect(peerId)
        await sleep(200)
        await withRetry('connect', () => BleClient.connect(peerId))
        console.log(`[Receiver] Connected to ${peerId}.`)

        await BleClient.requestConnectionPriority(peerId, 1)

        await sleep(TIMING.POST_CONNECT_SETTLE_MS)

        await BleClient.startNotifications(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID, onChunk)
        notifying = true

        const peerEnvelope = JSON.parse(await withRetry('read envelope', () => requestFile(true)))

        await applyEnvelopeUpdate({
            source: 'Receiver',
            remoteEnvelope: peerEnvelope,
            localEnvelope,
            fetchBlob: async (hash) => {
                const raw = await withRetry('read data', () => requestFile(false, hash))
                // await sleep(150)
                return JSON.stringify(JSON.parse(raw))
            },
        })
    } finally {
        if (notifying) {
            await BleClient.stopNotifications(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID).catch(() => { })
        }
        await safeDisconnect(peerId)
    }
}

function encodeText(text) { return new DataView(new TextEncoder().encode(text).buffer) }

async function safeDisconnect(peerId) {
    try { await BleClient.disconnect(peerId) }
    catch (e) { console.warn('[Receiver] Disconnect error:', e?.message || e) }
}