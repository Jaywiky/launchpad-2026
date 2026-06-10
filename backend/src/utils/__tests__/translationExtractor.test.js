const { extractTranslations, TRANS_PREFIX } = require('@/utils/translationExtractor');

const TRANS_REF_RE = /^trans [0-9a-f]{64}$/;

describe('extractTranslations', () => {
  test('replaces a translatable string field with a trans reference', () => {
    const store = {};
    const record = { type: 'toilet', name: 'Central Toilets', notes: null };

    extractTranslations(record, store);

    expect(record.name).toMatch(TRANS_REF_RE);
  });

  test('populates the store with the original english text', () => {
    const store = {};
    const record = { type: 'library', name: 'Ladywood Library', notes: null };

    extractTranslations(record, store);

    const entry = Object.values(store)[0];
    expect(entry.en).toBe('Ladywood Library');
  });

  test('records the resource type in the store entry', () => {
    const store = {};
    const record = { type: 'recycling', name: 'North Recycling', notes: null };

    extractTranslations(record, store);

    const entry = Object.values(store)[0];
    expect(entry.types.has('recycling')).toBe(true);
  });

  test('does not replace a field that is already a trans reference', () => {
    const store = {};
    const existingRef = `trans ${'a'.repeat(64)}`;
    const record = { type: 'toilet', name: existingRef, notes: null };

    extractTranslations(record, store);

    expect(record.name).toBe(existingRef);
    expect(Object.keys(store)).toHaveLength(0);
  });

  test('handles array fields by replacing each item', () => {
    const store = {};
    const record = {
      type: 'food_bank',
      name: 'City Food Bank',
      notes: null,
      extended: { needs: ['Tinned food', 'Rice'] },
    };

    extractTranslations(record, store);

    expect(record.extended.needs[0]).toMatch(TRANS_REF_RE);
    expect(record.extended.needs[1]).toMatch(TRANS_REF_RE);
    expect(Object.keys(store)).toHaveLength(3); // name + 2 needs
  });

  test('skips fields with no value (null/undefined)', () => {
    const store = {};
    const record = { type: 'toilet', name: null, notes: null };

    expect(() => extractTranslations(record, store)).not.toThrow();
    expect(Object.keys(store)).toHaveLength(0);
  });

  test('does not translate fields for unknown types', () => {
    const store = {};
    const record = { type: 'unknown', name: 'Some Place', notes: 'A note' };

    extractTranslations(record, store);

    expect(record.name).toBe('Some Place');
    expect(Object.keys(store)).toHaveLength(0);
  });

  test('identical text from two records shares one store entry', () => {
    const store = {};
    const r1 = { type: 'toilet', name: 'Public Toilet', notes: null };
    const r2 = { type: 'library', name: 'Public Toilet', notes: null };

    extractTranslations(r1, store);
    extractTranslations(r2, store);

    expect(Object.keys(store)).toHaveLength(1);
    const entry = Object.values(store)[0];
    expect(entry.types.has('toilet')).toBe(true);
    expect(entry.types.has('library')).toBe(true);
  });

  test('two different texts produce two separate store entries', () => {
    const store = {};
    const r1 = { type: 'toilet', name: 'Toilet A', notes: null };
    const r2 = { type: 'toilet', name: 'Toilet B', notes: null };

    extractTranslations(r1, store);
    extractTranslations(r2, store);

    expect(Object.keys(store)).toHaveLength(2);
  });
});
