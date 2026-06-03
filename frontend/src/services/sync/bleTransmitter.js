import { LadywoodGatt } from './nativeGatt'
import { readJsonFile } from '../storage/fileSystem'
import { loadLocalEnvelope } from './syncEngine'

export async function startBroadcasting() {
  const envelope = await loadLocalEnvelope()
  await LadywoodGatt.startBroadcasting({ version: envelope.version })
}

export async function stopBroadcasting() {
  await LadywoodGatt.stopBroadcasting()
}