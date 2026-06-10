const { haversineDistance } = require('@/utils/geo');

describe('haversineDistance', () => {
  test('returns 0 for identical coordinates', () => {
    expect(haversineDistance(51.5, -0.1, 51.5, -0.1)).toBe(0);
  });

  test('calculates distance between two London landmarks (~8.7 km)', () => {
    // Trafalgar Square to Tower Bridge
    const dist = haversineDistance(51.5080, -0.1281, 51.5055, -0.0754);
    expect(dist).toBeGreaterThan(3000);
    expect(dist).toBeLessThan(4500);
  });

  test('is symmetric — A to B equals B to A', () => {
    const ab = haversineDistance(51.5, -0.1, 52.0, 0.5);
    const ba = haversineDistance(52.0, 0.5, 51.5, -0.1);
    expect(ab).toBeCloseTo(ba, 5);
  });

  test('returns metres, not kilometres', () => {
    // ~111 km per degree latitude — should be ~111000 m, not ~111
    const dist = haversineDistance(51.0, 0.0, 52.0, 0.0);
    expect(dist).toBeGreaterThan(100_000);
  });
});
