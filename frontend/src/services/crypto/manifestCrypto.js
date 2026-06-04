import * as ed from '@noble/ed25519'
import { SERVER_CONFIG } from '../sync/serverConfig'

export function canonicalJson(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonicalJson).join(',') + ']'
    if (value && typeof value === 'object') {
        return (
            '{' +
            Object.keys(value)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k]))
                .join(',') +
            '}'
        )
    }
    return JSON.stringify(value ?? null)
}

export async function sha256Hex(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64ToBytes(b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

export async function verifyManifest(manifest) {
    if (!manifest || typeof manifest.signature !== 'string') return false
    const { signature, ...unsigned } = manifest
    try {
        const message = new TextEncoder().encode(canonicalJson(unsigned))
        const sig = base64ToBytes(signature)
        const pub = base64ToBytes(SERVER_CONFIG.MANIFEST_PUBLIC_KEY)
        return await ed.verifyAsync(sig, message, pub)
    } catch { return false }
}