jest.mock('@/services/resourceService');
const request = require('supertest');
const express = require('express');
const resourceRoutes = require('@/routes/resources');
const { getResources, getResourceById } = require('@/services/resourceService');

const app = express();
app.use(express.json());
app.use('/api', resourceRoutes);

const MOCK_RESOURCE = {
  id: 'overpass_1',
  name: 'Test Toilet',
  type: 'toilet',
  lat: 52.483,
  lng: -1.913,
  address: '10 High St',
  opening_hours: null,
  notes: null,
  source: 'overpass',
  lang: 'en',
  extended: {},
};

describe('GET /api/resources', () => {
  test('returns 200 with ok status and data array', async () => {
    getResources.mockResolvedValue([MOCK_RESOURCE]);

    const res = await request(app).get('/api/resources');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.count).toBe(1);
  });

  test('accepts a valid type query param', async () => {
    getResources.mockResolvedValue([]);

    const res = await request(app).get('/api/resources?type=toilet');

    expect(res.status).toBe(200);
    expect(res.body.meta.type).toBe('toilet');
  });

  test('returns 400 for an invalid type value', async () => {
    const res = await request(app).get('/api/resources?type=invalid_type');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('returns 400 for an invalid lang value', async () => {
    const res = await request(app).get('/api/resources?lang=!!!');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('defaults lang to "en" when not provided', async () => {
    getResources.mockResolvedValue([]);

    const res = await request(app).get('/api/resources');

    expect(res.status).toBe(200);
    expect(res.body.meta.lang).toBe('en');
  });
});

describe('GET /api/resources/:id', () => {
  test('returns 200 and resource when found', async () => {
    getResourceById.mockResolvedValue(MOCK_RESOURCE);

    const res = await request(app).get('/api/resources/overpass_1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.id).toBe('overpass_1');
  });

  test('returns 404 when resource does not exist', async () => {
    getResourceById.mockResolvedValue(null);

    const res = await request(app).get('/api/resources/overpass_999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for id with invalid pattern', async () => {
    const res = await request(app).get('/api/resources/badid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('accepts givefood_ prefixed ids', async () => {
    getResourceById.mockResolvedValue(MOCK_RESOURCE);

    const res = await request(app).get('/api/resources/givefood_some-slug');

    expect(res.status).toBe(200);
  });
});
