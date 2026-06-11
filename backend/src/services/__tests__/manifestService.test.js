jest.mock('@db/db', () => ({ query: jest.fn() }));
const pool = require('@db/db');
const { getManifest, getBlob } = require('@/services/manifestService');

const MOCK_MANIFEST = {
  version: 3,
  datasets: [{ data: 'abc123', translations: null }],
  signature: 'sig==',
};

beforeEach(() => jest.clearAllMocks());

describe('getManifest', () => {
  test('returns the stored manifest when one exists', async () => {
    pool.query.mockResolvedValue({ rows: [{ manifest: MOCK_MANIFEST }] });

    const result = await getManifest();

    expect(result).toEqual(MOCK_MANIFEST);
  });

  test('queries manifest_state table with id = 1', async () => {
    pool.query.mockResolvedValue({ rows: [{ manifest: MOCK_MANIFEST }] });

    await getManifest();

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('manifest_state');
    expect(sql).toContain('id = 1');
  });
});

describe('getBlob', () => {
  const VALID_HASH = 'a'.repeat(64);

  test('returns the blob body when hash is found', async () => {
    pool.query.mockResolvedValue({ rows: [{ body: '{"resources":[]}' }] });

    const result = await getBlob(VALID_HASH);

    expect(result).toBe('{"resources":[]}');
  });

  test('returns null when hash is not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getBlob(VALID_HASH);

    expect(result).toBeNull();
  });

  test('passes the hash as a query parameter', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getBlob(VALID_HASH);

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([VALID_HASH]);
  });
});
