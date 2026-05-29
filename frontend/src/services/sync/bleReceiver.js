import { BleClient } from '@capacitor-community/bluetooth-le'

import { readJsonFile, writeJsonFile, commitFile, deleteFile } from '../storage/fileSystem'
import { BLE_CONFIG } from './bleConfig'

// BLE is unreliable by nature; transient read/write failures are expected, so retry the
// individual GATT operations before giving up on the whole sync.
const GATT_RETRY_ATTEMPTS = 3
const GATT_RETRY_DELAY_MS = 300
// Some Android stacks reject the first GATT operation issued immediately after connect, while
// service discovery / the link is still settling. A brief pause noticeably cuts down on flakiness.
const POST_CONNECT_SETTLE_MS = 250

let localEnvelope = null
let localVersion = null
let isScanning = false
let isConnecting = false

export function getIsConnecting() {
    return isConnecting
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(label, fn) {
    let lastError
    for (let attempt = 1; attempt <= GATT_RETRY_ATTEMPTS; attempt++) {
        try {
            return await fn()
        } catch (e) {
            lastError = e
            console.warn(`[Receiver] ${label} attempt ${attempt}/${GATT_RETRY_ATTEMPTS} failed:`, e?.message || e)
            if (attempt < GATT_RETRY_ATTEMPTS) await sleep(GATT_RETRY_DELAY_MS)
        }
    }
    throw lastError
}

async function loadLocalEnvelope() {
    const previousVersion = localVersion
    try {
        localEnvelope = (await readJsonFile('envelope.json')) || { version: 0, datasets: [] }
    } catch (e) {
        console.warn('[Receiver] Could not read envelope.json; treating as version 0.', e)
        localEnvelope = { version: 0, datasets: [] }
    }
    localVersion = localEnvelope.version ?? 0
    if (localVersion !== previousVersion) {
        console.log(`[Receiver] Local version: ${localVersion}`)
    }
}

// Every content hash an envelope references: each dataset's data file plus all of its
// translation files. Identity is the hash itself, so syncing is a set difference over these.
function collectHashes(envelope) {
    const hashes = new Set()
    const datasets = envelope?.datasets
    if (!Array.isArray(datasets)) return hashes

    for (const dataset of datasets) {
        if (!dataset) continue
        if (dataset.data) hashes.add(dataset.data)

        const translations = dataset.translations
        if (translations && typeof translations === 'object') {
            for (const hash of Object.values(translations)) {
                if (hash) hashes.add(hash)
            }
        } else if (typeof translations === 'string' && translations) {
            hashes.add(translations)
        }
    }
    return hashes
}

export async function startScanning() {
    if (isScanning) return
    isScanning = true

    try {
        await loadLocalEnvelope()
        await BleClient.requestLEScan({ services: [BLE_CONFIG.SERVICE_UUID] }, onDeviceFound)
    } catch (e) {
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

    console.log(`[Receiver] Peer ${peerId} version ${peerVersion} (local ${localVersion}).`)
    if (peerVersion <= localVersion) return

    isConnecting = true
    try {
        await stopScanning()
        await syncFromPeer(peerId)
    } catch (e) {
        console.error('[Receiver] Sync failed:', e)
    } finally {
        isConnecting = false
    }
}

function parsePeerVersion(result) {
    const mfg = result.manufacturerData
    if (!mfg) return null

    const raw =
        mfg[BLE_CONFIG.MANUFACTURER_ID] ??
        mfg[String(BLE_CONFIG.MANUFACTURER_ID)] ??
        Object.values(mfg)[0]
    if (!raw) return null

    if (raw instanceof DataView) {
        return raw.byteLength > 0 ? raw.getUint8(0) : null
    }
    if (typeof raw === 'string') {
        const n = parseInt(raw, 16)
        return Number.isNaN(n) ? null : n
    }
    return null
}

async function syncFromPeer(peerId) {
    try {
        await withRetry('connect', () => BleClient.connect(peerId))
        console.log(`[Receiver] Connected to ${peerId}.`)
        await sleep(POST_CONNECT_SETTLE_MS)

        const peerEnvelope = await withRetry('read envelope', () =>
            readJson(peerId, BLE_CONFIG.ENVELOPE_UUID))
        if (!peerEnvelope || !Array.isArray(peerEnvelope.datasets)) {
            throw new Error('Peer envelope is missing a datasets array')
        }

        // TODO: verify peerEnvelope.signature over the canonical envelope bytes BEFORE trusting
        // anything below. Until that is in place, any peer can advertise arbitrary data.

        const localHashes = collectHashes(localEnvelope)
        const peerHashes = collectHashes(peerEnvelope)

        // Content addressing: a hash we already hold is byte-identical, so only fetch new ones.
        const toDownload = [...peerHashes].filter((hash) => !localHashes.has(hash))

        await writeJsonFile('tmp/envelope.json', peerEnvelope)

        for (const hash of toDownload) {
            console.log(`[Receiver] Fetching ${hash}.`)
            await withRetry('write hash', () =>
                BleClient.write(peerId, BLE_CONFIG.SERVICE_UUID, BLE_CONFIG.DATA_UUID, encodeText(hash)))

            const jsonData = await withRetry('read data', () =>
                readJson(peerId, BLE_CONFIG.DATA_UUID))
            await writeJsonFile(`tmp/${hash}.json`, jsonData)
        }

        // Stage everything first, then commit data files, then the envelope that points at them.
        for (const hash of toDownload) {
            await commitFile(`tmp/${hash}.json`, `json_data/${hash}.json`)
        }
        await commitFile('tmp/envelope.json', 'envelope.json')

        // Drop any files the new envelope no longer references so storage does not grow forever.
        const stale = [...localHashes].filter((hash) => !peerHashes.has(hash))
        for (const hash of stale) {
            try {
                await deleteFile(`json_data/${hash}.json`)
                console.log(`[Receiver] Removed stale ${hash}.`)
            } catch (e) {
                console.warn(`[Receiver] Could not delete stale ${hash}:`, e)
            }
        }

        localEnvelope = peerEnvelope
        localVersion = peerEnvelope.version ?? localVersion
        window.dispatchEvent(new Event('meshSyncUpdated'))
        console.log(`[Receiver] Sync complete: ${toDownload.length} added, ${stale.length} removed.`)
    } finally {
        await safeDisconnect(peerId)
    }
}

async function readJson(peerId, characteristicUuid) {
    const view = await BleClient.read(peerId, BLE_CONFIG.SERVICE_UUID, characteristicUuid)
    return JSON.parse(new TextDecoder().decode(view))
}

function encodeText(text) {
    return new DataView(new TextEncoder().encode(text).buffer)
}

async function safeDisconnect(peerId) {
    try {
        await BleClient.disconnect(peerId)
    } catch (e) {
        console.warn('[Receiver] Disconnect error:', e)
    }
}