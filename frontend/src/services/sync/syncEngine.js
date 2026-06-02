import { readJsonFile, writeJsonFile, commitFile, deleteFile } from '../storage/fileSystem'
import { verifyManifest, sha256Hex } from '../crypto/manifestCrypto'

export function collectHashes(envelope) {
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

export async function loadLocalEnvelope() {
    try { return (await readJsonFile('envelope.json')) || { version: 0, datasets: [] } }
    catch (e) {
        console.warn('[Sync] Could not read envelope.json treating as version 0.', e)
        return { version: 0, datasets: [] }
    }
}

export async function applyEnvelopeUpdate({ source, remoteEnvelope, localEnvelope, fetchBlob }) {
    if (!remoteEnvelope || !Array.isArray(remoteEnvelope.datasets))
        throw new Error('Remote envelope is missing a datasets array')

    console.log(`[INFO] Remote env ${JSON.stringify(remoteEnvelope, null, 2)}`)

    if (!(await verifyManifest(remoteEnvelope)))
        throw new Error(`[${source}] envelope signature failed verification`)

    console.log("[PASS] Remote host passed sig check")

    const remoteVersion = remoteEnvelope.version ?? 0
    const localVersion = localEnvelope?.version ?? 0

    if (remoteVersion <= localVersion) {
        console.log(`[${source}] Already at version ${localVersion} nothing to do.`)
        return null
    }

    const localHashes = collectHashes(localEnvelope)
    const remoteHashes = collectHashes(remoteEnvelope)

    const toDownload = [...remoteHashes].filter((h) => !localHashes.has(h))

    await writeJsonFile('tmp/envelope.json', remoteEnvelope)

    for (const hash of toDownload) {
        console.log(`[${source}] Fetching ${hash}.`)
        // console.log(`[NOTE] Prepering to download ${hash}`)
        const body = await fetchBlob(hash)
        const digest = await sha256Hex(body)
        if (digest !== hash)
            throw new Error(`[${source}] blob ${hash} failed integrity check (got ${digest})`)
        console.log(`[PASS] Remote file of hash ${hash} passed sig check`)

        const jsonData = JSON.parse(body)

        await writeJsonFile(`tmp/${hash}.json`, jsonData)
    }

    for (const hash of toDownload) { await commitFile(`tmp/${hash}.json`, `json_data/${hash}.json`) }
    await commitFile('tmp/envelope.json', 'envelope.json')

    const stale = [...localHashes].filter((h) => !remoteHashes.has(h))

    for (const hash of stale) {
        try { await deleteFile(`json_data/${hash}.json`) }
        catch (e) { console.warn(`[${source}] Could not delete stale ${hash}:`, e) }
    }

    window.dispatchEvent(new Event('resourceUpdated'))
    console.log(`[${source}] Synced to version ${remoteVersion}: ${toDownload.length} added, ${stale.length} removed.`)
    return { version: remoteVersion, added: toDownload.length, removed: stale.length }
}