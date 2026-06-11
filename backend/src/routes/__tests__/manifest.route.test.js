jest.mock('@/services/manifestService');
const request = require('supertest');
const express = require('express');
const manifestRoutes = require('@/routes/manifest');
const { getManifest, getBlob } = require('@/services/manifestService');

const app = express();
app.use(express.json());
app.use('/api', manifestRoutes);

const MOCK_MANIFEST = {
  version: 1,
  datasets: [{ data: 'a'.repeat(64), translations: null }],
  signature: 'sig==',
};

const VALID_HASH = 'b'.repeat(64);

describe('GET /api/manifest', () => {
  test('returns 200 with the manifest object', async () => {
    getManifest.mockResolvedValue(MOCK_MANIFEST);

    const res = await request(app).get('/api/manifest');

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.signature).toBe('sig==');
  });

  test('forwards service errors to the error handler', async () => {
    getManifest.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/api/manifest');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/blob/:hash', () => {
  test('returns 200 and the blob body for a valid known hash', async () => {
    getBlob.mockResolvedValue('{"resources":[]}');

    const res = await request(app).get(`/api/blob/${VALID_HASH}`);

    expect(res.status).toBe(200);
    expect(res.text).toBe('{"resources":[]}');
  });

  test('returns 404 for a valid but unknown hash', async () => {
    getBlob.mockResolvedValue(null);

    const res = await request(app).get(`/api/blob/${VALID_HASH}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for a hash that is not 64 hex chars', async () => {
    const res = await request(app).get('/api/blob/notahash');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('returns 400 for a hash with uppercase chars', async () => {
    const res = await request(app).get(`/api/blob/${'A'.repeat(64)}`);

    expect(res.status).toBe(400);
  });
});
