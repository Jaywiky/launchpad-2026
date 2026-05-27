import { Network } from '@capacitor/network';

export async function runFullSyncCycle() {
  // 1. Check if we have internet
  const status = await Network.getStatus();

  if (status.connected) {
    console.log("Wi-Fi/Data detected. Polling server directly...");
  } else {
    console.log("Offline mode. Triggering BLE P2P scan...");
  }
}