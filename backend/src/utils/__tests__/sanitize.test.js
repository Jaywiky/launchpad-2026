const { sanitizeResources } = require('@/utils/sanitize');

describe('sanitizeResources', () => {
  test('preserves name when it is a real name', () => {
    const input = [{ name: 'St. Pancras Library', type: 'library' }];
    const [result] = sanitizeResources(input);
    expect(result.name).toBe('St. Pancras Library');
  });

  test('replaces "unnamed" name with default for known type', () => {
    const input = [{ name: 'Unnamed: toilet', type: 'toilet' }];
    const [result] = sanitizeResources(input);
    expect(result.name).toBe('Public Toilet');
  });

  test('replaces "unnamed" name with default for food_bank', () => {
    const input = [{ name: 'Unnamed food bank', type: 'food_bank' }];
    const [result] = sanitizeResources(input);
    expect(result.name).toBe('Food Bank');
  });

  test('keeps original name when type has no default', () => {
    const input = [{ name: 'Unnamed place', type: 'unknown_type' }];
    const [result] = sanitizeResources(input);
    expect(result.name).toBe('Unnamed place');
  });

  test('does not mutate the original resource', () => {
    const input = [{ name: 'Unnamed toilet', type: 'toilet' }];
    sanitizeResources(input);
    expect(input[0].name).toBe('Unnamed toilet');
  });

  test('handles null/undefined name without throwing', () => {
    const input = [{ name: null, type: 'toilet' }];
    expect(() => sanitizeResources(input)).not.toThrow();
  });

  test('processes multiple resources', () => {
    const input = [
      { name: 'Real Name', type: 'library' },
      { name: 'Unnamed library', type: 'library' },
    ];
    const results = sanitizeResources(input);
    expect(results[0].name).toBe('Real Name');
    expect(results[1].name).toBe('Library');
  });
});
