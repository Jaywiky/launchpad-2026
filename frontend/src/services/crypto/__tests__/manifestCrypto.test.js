import { canonicalJson, sha256Hex, verifyManifest } from '@/services/crypto/manifestCrypto'

describe('canonicalJson', () => {
  test('serialises null', () => {
    expect(canonicalJson(null)).toBe('null')
  })

  test('serialises a string', () => {
    expect(canonicalJson('hello')).toBe('"hello"')
  })

  test('serialises a number', () => {
    expect(canonicalJson(42)).toBe('42')
  })

  test('serialises a boolean', () => {
    expect(canonicalJson(true)).toBe('true')
  })

  test('serialises an array', () => {
    expect(canonicalJson([1, 2, 3])).toBe('[1,2,3]')
  })

  test('serialises object with keys sorted alphabetically', () => {
    const obj = { z: 1, a: 2, m: 3 }
    expect(canonicalJson(obj)).toBe('{"a":2,"m":3,"z":1}')
  })

  test('serialises nested objects with sorted keys', () => {
    const obj = { b: { y: 1, x: 2 }, a: 0 }
    expect(canonicalJson(obj)).toBe('{"a":0,"b":{"x":2,"y":1}}')
  })

  test('two objects with same keys in different order produce identical output', () => {
    const a = { version: 1, signature: 'sig', datasets: [] }
    const b = { datasets: [], signature: 'sig', version: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
  })

  test('treats undefined values as null', () => {
    expect(canonicalJson(undefined)).toBe('null')
  })
})

describe('sha256Hex', () => {
  test('returns a 64-character hex string', async () => {
    const result = await sha256Hex('hello')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  test('is deterministic for the same input', async () => {
    const a = await sha256Hex('test input')
    const b = await sha256Hex('test input')
    expect(a).toBe(b)
  })

  test('different inputs produce different hashes', async () => {
    const a = await sha256Hex('input A')
    const b = await sha256Hex('input B')
    expect(a).not.toBe(b)
  })

  test('accepts a Uint8Array as input', async () => {
    const bytes = new TextEncoder().encode('hello')
    const fromBytes = await sha256Hex(bytes)
    const fromString = await sha256Hex('hello')
    expect(fromBytes).toBe(fromString)
  })
})

describe('verifyManifest', () => {
  test('returns false for null input', async () => {
    expect(await verifyManifest(null)).toBe(false)
  })

  test('returns false when signature is missing', async () => {
    expect(await verifyManifest({ version: 1, datasets: [] })).toBe(false)
  })

  test('returns false when signature is not a string', async () => {
    expect(await verifyManifest({ version: 1, datasets: [], signature: 123 })).toBe(false)
  })

  test('returns false for a tampered/invalid signature', async () => {
    const manifest = { version: 1, datasets: [], signature: 'invalidsig==' }
    expect(await verifyManifest(manifest)).toBe(false)
  })
})
