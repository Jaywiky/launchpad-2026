import { Network } from '@capacitor/network'

import * as BleManager from './bleManager'
import { runServerSync } from './serverSync'
import { SERVER_CONFIG } from './serverConfig'

let running = false
let networkListenerHandle = null
let serverSyncTimer = null
let serverSyncInFlight = false

async function maybeServerSync() {
    if (serverSyncInFlight) return

    let status
    try { status = await Network.getStatus() }
    catch (e) { console.warn('[Sync] Could not read network status:', e); return }

    if (!status?.connected) { console.log('[Sync] Offline relying on the BLE mesh.'); return }

    serverSyncInFlight = true
    try { await runServerSync() }
    catch (e) { console.error('[Sync] Server sync failed:', e?.name, '-', e?.message ?? e) }
    finally { serverSyncInFlight = false }
}

export async function startSyncManager() {
    if (running) return
    running = true
    await BleManager.startP2PNetwork()
    if (!networkListenerHandle)
        networkListenerHandle = await Network.addListener('networkStatusChange', (status) => { if (status.connected) maybeServerSync() })

    if (!serverSyncTimer)
        serverSyncTimer = setInterval(maybeServerSync, SERVER_CONFIG.SERVER_SYNC_INTERVAL_MS)

    maybeServerSync()
}

export async function stopSyncManager() {
    if (!running) return
    running = false

    if (serverSyncTimer) {
        clearInterval(serverSyncTimer)
        serverSyncTimer = null
    }
    if (networkListenerHandle) {
        await networkListenerHandle.remove()
        networkListenerHandle = null
    }
    await BleManager.stopP2PNetwork()
}