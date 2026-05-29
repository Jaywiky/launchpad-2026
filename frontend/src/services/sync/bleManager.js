import { BleClient } from '@capacitor-community/bluetooth-le'

import * as Transmitter from './bleTransmitter'
import * as Receiver from './bleReceiver'
import { LadywoodGatt } from './nativeGatt'
import { TIMING } from './bleConfig'

let isRunning = false
let cycleTimer = null
let cycleInFlight = false

let pendingTimeout = null
let pendingResolve = null

function delay(ms) {
    return new Promise((resolve) => {
        pendingResolve = resolve
        pendingTimeout = setTimeout(() => {
            pendingTimeout = null
            pendingResolve = null
            resolve()
        }, ms)
    })
}

function cancelDelay() {
    if (pendingTimeout) {
        clearTimeout(pendingTimeout)
        pendingTimeout = null
    }
    if (pendingResolve) {
        pendingResolve()
        pendingResolve = null
    }
}

export async function initializeBleHardware() {
    try {
        await BleClient.initialize()
        await LadywoodGatt.requestPermissions()
        console.log('[BLE] Bluetooth initialized.')
        return true
    } catch (e) {
        console.error('[BLE] Failed to initialize:', e)
        return false
    }
}

async function runCycle() {
    if (!isRunning || cycleInFlight) return

    if (Receiver.getIsConnecting()) {
        console.log('[BLE] Download in progress skipping this cycle.')
        return
    }

    cycleInFlight = true
    try {
        await Transmitter.stopBroadcasting()
        await Receiver.startScanning()

        await delay(TIMING.SCAN_WINDOW_MS)
        if (!isRunning) return

        await Receiver.stopScanning()

        if (Receiver.getIsConnecting()) return

        await Transmitter.startBroadcasting()
    } catch (e) {
        console.error('[BLE] Cycle error:', e)
    } finally {
        cycleInFlight = false
    }
}

export async function startP2PNetwork() {
    if (isRunning) return
    isRunning = true
    console.log('[BLE] Starting peer-to-peer network.')

    runCycle()
    cycleTimer = setInterval(runCycle, TIMING.CYCLE_INTERVAL_MS)
}

export async function stopP2PNetwork() {
    if (!isRunning) return
    isRunning = false
    console.log('[BLE] Shutting down peer-to-peer network.')

    if (cycleTimer) {
        clearInterval(cycleTimer)
        cycleTimer = null
    }
    cancelDelay()

    await Transmitter.stopBroadcasting()
    await Receiver.stopScanning()
}