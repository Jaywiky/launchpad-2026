import { SERVER_CONFIG } from './serverConfig'
import { loadLocalEnvelope, applyEnvelopeUpdate } from './syncEngine'

async function request(path) {
    let res
    try { res = await fetch(`${SERVER_CONFIG.BASE_URL}${path}`) }
    catch (e) { throw new Error(`Request to ${path} failed: ${e?.name || 'Error'} - ${e?.message || e}`) }

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
    return res
}

export async function runServerSync() {
    const manifest = await (await request('/api/manifest')).json()
    const local = await loadLocalEnvelope()

    await applyEnvelopeUpdate({
        source: 'ServerSync',
        remoteEnvelope: manifest,
        localEnvelope: local,
        fetchBlob: async (hash) => request(`/api/blob/${hash}`).then((r) => r.text()),
    })
}