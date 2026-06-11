import { vi } from 'vitest'

vi.mock('@/services/storage/fileSystem', () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn().mockResolvedValue(true),
  commitFile: vi.fn().mockResolvedValue(true),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/services/crypto/manifestCrypto', () => ({
  verifyManifest: vi.fn().mockResolvedValue(true),
  sha256Hex: vi.fn(),
}))

import { readJsonFile, writeJsonFile, commitFile, deleteFile } from '@/services/storage/fileSystem'
import { verifyManifest, sha256Hex } from '@/services/crypto/manifestCrypto'
import { collectHashes, loadLocalEnvelope, applyEnvelopeUpdate } from '@/services/sync/syncEngine'

beforeEach(() => vi.clearAllMocks())

describe('collectHashes', () => {
  test('returns empty set for undefined envelope', () => {
    expect(collectHashes(undefined).size).toBe(0)
  })

  test('returns empty set when datasets is not an array', () => {
    expect(collectHashes({ datasets: null }).size).toBe(0)
  })

  test('collects data hashes from datasets', () => {
    const envelope = { datasets: [{ data: 'hash1' }, { data: 'hash2' }] }
    const hashes = collectHashes(envelope)
    expect(hashes.has('hash1')).toBe(true)
    expect(hashes.has('hash2')).toBe(true)
  })

  test('collects string translations hash', () => {
    const envelope = { datasets: [{ data: 'dh', translations: 'th' }] }
    const hashes = collectHashes(envelope)
    expect(hashes.has('th')).toBe(true)
  })

  test('collects object translations hashes by value', () => {
    const envelope = { datasets: [{ data: 'dh', translations: { en: 'eh', ur: 'uh' } }] }
    const hashes = collectHashes(envelope)
    expect(hashes.has('eh')).toBe(true)
    expect(hashes.has('uh')).toBe(true)
  })

  test('skips null dataset entries', () => {
    const envelope = { datasets: [null, { data: 'hash1' }] }
    expect(() => collectHashes(envelope)).not.toThrow()
    expect(collectHashes(envelope).has('hash1')).toBe(true)
  })
})

describe('loadLocalEnvelope', () => {
  test('returns file contents when file exists', async () => {
    const stored = { version: 5, datasets: [] }
    readJsonFile.mockResolvedValue(stored)
    expect(await loadLocalEnvelope()).toEqual(stored)
  })

  test('returns version-0 envelope when file is missing', async () => {
    readJsonFile.mockRejectedValue(new Error('not found'))
    const result = await loadLocalEnvelope()
    expect(result.version).toBe(0)
    expect(result.datasets).toEqual([])
  })

  test('returns version-0 envelope when file returns falsy', async () => {
    readJsonFile.mockResolvedValue(null)
    const result = await loadLocalEnvelope()
    expect(result.version).toBe(0)
  })
})

describe('applyEnvelopeUpdate', () => {
  const localEnvelope = { version: 1, datasets: [{ data: 'oldhash' }] }
  const remoteEnvelope = { version: 2, datasets: [{ data: 'newhash' }], signature: 'sig' }

  function makeArgs(overrides = {}) {
    return {
      source: 'server',
      remoteEnvelope,
      localEnvelope,
      fetchBlob: vi.fn().mockResolvedValue('{"data":"ok"}'),
      ...overrides,
    }
  }

  test('throws when remoteEnvelope has no datasets array', async () => {
    await expect(applyEnvelopeUpdate(makeArgs({ remoteEnvelope: { version: 2 } })))
      .rejects.toThrow('datasets array')
  })

  test('throws when manifest verification fails', async () => {
    verifyManifest.mockResolvedValueOnce(false)
    await expect(applyEnvelopeUpdate(makeArgs()))
      .rejects.toThrow('signature failed verification')
  })

  test('returns null when remote version is not newer', async () => {
    const args = makeArgs({ remoteEnvelope: { ...remoteEnvelope, version: 1 } })
    const result = await applyEnvelopeUpdate(args)
    expect(result).toBeNull()
  })

  test('returns null when remote version is older', async () => {
    const args = makeArgs({ remoteEnvelope: { ...remoteEnvelope, version: 0 } })
    const result = await applyEnvelopeUpdate(args)
    expect(result).toBeNull()
  })

  test('fetches only hashes not in the local envelope', async () => {
    sha256Hex.mockResolvedValue('newhash')
    const fetchBlob = vi.fn().mockResolvedValue('{}')
    await applyEnvelopeUpdate(makeArgs({ fetchBlob }))
    expect(fetchBlob).toHaveBeenCalledWith('newhash')
    expect(fetchBlob).not.toHaveBeenCalledWith('oldhash')
  })

  test('throws when blob integrity check fails', async () => {
    sha256Hex.mockResolvedValue('wronghash')
    await expect(applyEnvelopeUpdate(makeArgs()))
      .rejects.toThrow('integrity check')
  })

  test('deletes stale hashes that are not in remote envelope', async () => {
    sha256Hex.mockResolvedValue('newhash')
    await applyEnvelopeUpdate(makeArgs())
    expect(deleteFile).toHaveBeenCalledWith('json_data/oldhash.json')
  })

  test('returns version, added, and removed counts on success', async () => {
    sha256Hex.mockResolvedValue('newhash')
    const result = await applyEnvelopeUpdate(makeArgs())
    expect(result.version).toBe(2)
    expect(result.added).toBe(1)
    expect(result.removed).toBe(1)
  })

  test('commits new blobs and envelope on success', async () => {
    sha256Hex.mockResolvedValue('newhash')
    await applyEnvelopeUpdate(makeArgs())
    expect(commitFile).toHaveBeenCalledWith('tmp/newhash.json', 'json_data/newhash.json')
    expect(commitFile).toHaveBeenCalledWith('tmp/envelope.json', 'envelope.json')
  })
})
