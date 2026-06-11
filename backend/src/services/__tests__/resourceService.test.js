jest.mock('@db/db', () => ({ query: jest.fn() }));
const pool = require('@db/db');
const { getResources, getResourceById } = require('@/services/resourceService');

const RAW_ROW = {
  id: 'overpass_1',
  name: 'Test Toilet',
  type: 'toilet',
  lat: '52.483000',
  lng: '-1.913000',
  address: '10 High St',
  opening_hours: null,
  notes: '',
  source: 'overpass',
  lang: 'en',
  extended: { accessible: true },
};

beforeEach(() => jest.clearAllMocks());

describe('getResources', () => {
  test('queries without type filter when type is null', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getResources({ type: null, lang: 'en' });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toContain('WHERE');
  });

  test('queries with type filter when type is provided', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getResources({ type: 'toilet', lang: 'en' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE');
    expect(params).toEqual(['toilet']);
  });

  test('returns formatted resources', async () => {
    pool.query.mockResolvedValue({ rows: [RAW_ROW] });

    const results = await getResources({ type: null, lang: 'en' });

    expect(results).toHaveLength(1);
    expect(results[0].lat).toBe(52.483);
    expect(results[0].lng).toBe(-1.913);
  });

  test('converts lat/lng strings to floats', async () => {
    pool.query.mockResolvedValue({ rows: [RAW_ROW] });

    const [result] = await getResources({ type: null, lang: 'en' });

    expect(typeof result.lat).toBe('number');
    expect(typeof result.lng).toBe('number');
  });

  test('coerces empty notes string to null', async () => {
    pool.query.mockResolvedValue({ rows: [RAW_ROW] });

    const [result] = await getResources({ type: null, lang: 'en' });

    expect(result.notes).toBeNull();
  });

  test('defaults extended to empty object when null', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...RAW_ROW, extended: null }] });

    const [result] = await getResources({ type: null, lang: 'en' });

    expect(result.extended).toEqual({});
  });
});

describe('getResourceById', () => {
  test('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getResourceById('overpass_999');

    expect(result).toBeNull();
  });

  test('passes the id as query parameter', async () => {
    pool.query.mockResolvedValue({ rows: [RAW_ROW] });

    await getResourceById('overpass_1');

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['overpass_1']);
  });

  test('returns a formatted resource when found', async () => {
    pool.query.mockResolvedValue({ rows: [RAW_ROW] });

    const result = await getResourceById('overpass_1');

    expect(result.id).toBe('overpass_1');
    expect(result.lat).toBe(52.483);
  });
});
