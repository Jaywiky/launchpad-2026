jest.mock('axios');
const axios = require('axios');
const overpass = require('@/apis/overpass');

function makeElement(overrides = {}) {
  return {
    id: 1,
    lat: 52.483,
    lon: -1.913,
    tags: { amenity: 'toilets' },
    ...overrides,
  };
}

describe('overpass.fetch — filtering', () => {
  test('excludes elements with restricted access', async () => {
    const el = makeElement({ tags: { amenity: 'toilets', access: 'private' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });

  test('excludes disused elements', async () => {
    const el = makeElement({ tags: { amenity: 'toilets', status: 'disused' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });

  test('excludes unnamed gardens', async () => {
    const el = makeElement({ tags: { leisure: 'garden' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });

  test('includes named gardens', async () => {
    const el = makeElement({ tags: { leisure: 'garden', name: 'Victoria Gardens' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(1);
  });

  test('excludes recycling with no accepted materials', async () => {
    const el = makeElement({ tags: { amenity: 'recycling' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });

  test('includes recycling with at least one accepted material', async () => {
    const el = makeElement({ tags: { amenity: 'recycling', 'recycling:glass': 'yes' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(1);
  });

  test('excludes elements with unknown type', async () => {
    const el = makeElement({ tags: { unknown_tag: 'something' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });

  test('handles empty elements array', async () => {
    axios.post.mockResolvedValue({ data: { elements: [] } });

    const results = await overpass.fetch();

    expect(results).toHaveLength(0);
  });
});

describe('overpass.fetch — mapping', () => {
  test('maps toilet element with overpass_ id prefix', async () => {
    const el = makeElement({ id: 42, tags: { amenity: 'toilets' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.id).toBe('overpass_42');
    expect(result.type).toBe('toilet');
    expect(result.source).toBe('overpass');
  });

  test('uses center coordinates for way elements', async () => {
    const el = { id: 99, tags: { amenity: 'library' }, center: { lat: 52.5, lon: -1.9 } };
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.lat).toBe(52.5);
    expect(result.lng).toBe(-1.9);
  });

  test('builds address from addr tags', async () => {
    const el = makeElement({
      tags: { amenity: 'toilets', 'addr:housenumber': '10', 'addr:street': 'High St', 'addr:city': 'Birmingham' },
    });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.address).toBe('10, High St, Birmingham');
  });

  test('uses "Address unavailable" when no address tags', async () => {
    const el = makeElement({ tags: { amenity: 'toilets' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.address).toBe('Address unavailable');
  });

  test('maps library extended fields', async () => {
    const el = makeElement({
      tags: { amenity: 'library', operator: 'Birmingham Libraries', internet_access: 'wlan', wheelchair: 'yes' },
    });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.extended.operator).toBe('Birmingham Libraries');
    expect(result.extended.wifi).toBe(true);
    expect(result.extended.wheelchair).toBe('yes');
  });

  test('maps recycling accepted materials from recycling: tags', async () => {
    const el = makeElement({
      tags: { amenity: 'recycling', 'recycling:glass': 'yes', 'recycling:paper': 'yes', 'recycling:metal': 'no' },
    });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.extended.accepts).toEqual(expect.arrayContaining(['glass', 'paper']));
    expect(result.extended.accepts).not.toContain('metal');
  });

  test('maps toilet accessible field from wheelchair tag', async () => {
    const el = makeElement({ tags: { amenity: 'toilets', wheelchair: 'yes' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.extended.accessible).toBe(true);
  });

  test('maps green_space type for park leisure tag', async () => {
    const el = makeElement({ tags: { leisure: 'park', name: 'Central Park' } });
    axios.post.mockResolvedValue({ data: { elements: [el] } });

    const [result] = await overpass.fetch();

    expect(result.type).toBe('green_space');
  });
});
