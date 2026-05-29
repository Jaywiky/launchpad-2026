import * as BleManager from './bleManager'

export async function runFullSyncCycle() {
    await BleManager.startP2PNetwork()
}