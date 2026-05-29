import { LadywoodGatt } from './nativeGatt'
import { readJsonFile } from '../storage/fileSystem'

export async function startBroadcasting() {
  const envelope = await readJsonFile('envelope.json')
  const version = envelope?.version ?? 0
  await LadywoodGatt.startBroadcasting({ version })
}

export async function stopBroadcasting() {
  await LadywoodGatt.stopBroadcasting()
}