import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le'
import { readJsonData, writeJsonData, commitFile } from '../storage/fileSystem'

const LADYWOOD_SERVICE_UUID = "f0bffd13-ad4e-4882-8fc7-cdfcabd00e73"
const ENVELOPE_CHAR_UUID = "9ab41921-747a-42d7-89df-4164a2e64421"
const DATA_CHAR_UUID = "848cb058-7689-4b50-b207-92c33e6e630d"

const APP_MANUFACTURER_ID = 0xFFFF

let isScanning = false
let scanIntervalId = null
let version = null
let envelope = null

export async function initializeBluetooth() {
    try {
        await BleClient.initialize()
        console.log("Bluetooth initialized successfully.")
        return true
    } catch (error) {
        console.error("Failed to initialize Bluetooth:", error)
        return false
    }
}

export async function startBleSync() {
    if (scanIntervalId) return

    envelope = await readJsonData("envelope.json")
    version = myEnvelope ? myEnvelope.version : 0

    const runScanCycle = async () => {
        const jitterMs = Math.floor(Math.random() * 5000)
        setTimeout(async () => {
            await scanForPeers()
        }, jitterMs)
    }

    runScanCycle()
    scanIntervalId = setInterval(runScanCycle, 30000)
}

async function scanForPeers() {
    if (isScanning) return
    isScanning = true

    try {
        console.log("Starting 3-second BLE scan...")

        if (version === null) {
            const myEnvelope = await readJsonData("envelope.json")
            version = myEnvelope ? myEnvelope.version : 0
        }

        const handleVersionID = async (result) => {
            const mfgDataView = result.manufacturerData?.[APP_MANUFACTURER_ID]

            if (!mfgDataView) {
                console.log("peer has no version data")
                return
            }

            

            const peerVersion = mfgDataView.getUint8(0)
            console.log("peer version: ${peerVersion}. current version: ${version}.")

            if (peerVersion > version) {
                console.log("peers version higher")

                await BleClient.stopLEScan()
                isScanning = false

                // TODO write function to download required files from peer
            } else {
                console.log("Peer data is old. Ignoring without connecting.")
            }
        }

        await BleClient.requestLEScan({ services: [LADYWOOD_SERVICE_UUID] }, handleVersionID)

        setTimeout(async () => {
            if (isScanning) {
                await BleClient.stopLEScan()
                isScanning = false
                console.log("BLE scan paused for battery conservation.")
            }
        }, 3000)

    } catch (error) {
        console.error("BLE Scan Error:", error)
        isScanning = false
    }
}

async function receiveLargeJsonOverBle(deviceId, characteristicUuid) {
    const data = await BleClient.read(deviceId, LADYWOOD_SERVICE_UUID, characteristicUuid)
    return new TextDecoder().decode(data)
}
function textToBleData(text) {
    const buffer = new TextEncoder().encode(text)
    return new DataView(buffer.buffer)
}
q