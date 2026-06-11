jest.mock('axios');
const axios = require('axios');
const givefood = require('@/apis/givefood');

// Coordinates within 5km of Ladywood centre (52.483, -1.913)
const NEARBY = { lat_lng: '52.484,-1.914', slug: 'test-bank', name: 'Test Food Bank', closed: false, address: 'Test St\nBirmingham', phone: '0121000000', urls: { homepage: 'https://example.com' } };
const FAR_AWAY = { lat_lng: '53.0,-2.5', slug: 'far-bank', name: 'Far Food Bank', closed: false, address: null };
const CLOSED = { lat_lng: '52.484,-1.914', slug: 'closed-bank', name: 'Closed Bank', closed: true, address: null };

describe('givefood.fetch', () => {
  test('returns only open food banks within the radius', async () => {
    axios.get.mockResolvedValue({ data: [NEARBY, FAR_AWAY, CLOSED] });

    const results = await givefood.fetch();

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('givefood_test-bank');
  });

  test('maps id with givefood_ prefix', async () => {
    axios.get.mockResolvedValue({ data: [NEARBY] });

    const [result] = await givefood.fetch();

    expect(result.id).toBe('givefood_test-bank');
    expect(result.type).toBe('food_bank');
    expect(result.source).toBe('givefood');
  });

  test('normalises multiline address to a single line', async () => {
    axios.get.mockResolvedValue({ data: [NEARBY] });

    const [result] = await givefood.fetch();

    expect(result.address).not.toContain('\n');
    expect(result.address).toBe('Test St, Birmingham');
  });

  test('uses "Address unavailable" when address is missing', async () => {
    const noAddr = { ...NEARBY, address: null };
    axios.get.mockResolvedValue({ data: [noAddr] });

    const [result] = await givefood.fetch();

    expect(result.address).toBe('Address unavailable');
  });

  test('parses lat and lng as numbers', async () => {
    axios.get.mockResolvedValue({ data: [NEARBY] });

    const [result] = await givefood.fetch();

    expect(typeof result.lat).toBe('number');
    expect(typeof result.lng).toBe('number');
  });

  test('maps phone and url into extended', async () => {
    axios.get.mockResolvedValue({ data: [NEARBY] });

    const [result] = await givefood.fetch();

    expect(result.extended.phone).toBe('0121000000');
    expect(result.extended.url).toBe('https://example.com');
  });
});

describe('givefood.fetchById', () => {
  const detailedItem = {
    ...NEARBY,
    need: { needs: 'Tinned food\nRice\nPasta' },
  };

  test('returns null when the food bank is closed', async () => {
    axios.get.mockResolvedValue({ data: { ...detailedItem, closed: true } });

    const result = await givefood.fetchById('givefood_test-bank');

    expect(result).toBeNull();
  });

  test('returns null when data is empty', async () => {
    axios.get.mockResolvedValue({ data: null });

    const result = await givefood.fetchById('givefood_test-bank');

    expect(result).toBeNull();
  });

  test('strips the givefood_ prefix when building the URL', async () => {
    axios.get.mockResolvedValue({ data: detailedItem });

    await givefood.fetchById('givefood_test-bank');

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/foodbank/test-bank/'),
      expect.any(Object),
    );
  });

  test('parses needs from newline-separated string', async () => {
    axios.get.mockResolvedValue({ data: detailedItem });

    const result = await givefood.fetchById('givefood_test-bank');

    expect(result.extended.needs).toEqual(['Tinned food', 'Rice', 'Pasta']);
  });

  test('returns empty needs array when need field is missing', async () => {
    axios.get.mockResolvedValue({ data: { ...NEARBY, need: null } });

    const result = await givefood.fetchById('givefood_test-bank');

    expect(result.extended.needs).toEqual([]);
  });
});
