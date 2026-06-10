import {computeContentHash} from '../../src/common/utils/content-hash';

describe('computeContentHash', () => {
  it('returns a stable hex SHA-256 for identical normalised content', () => {
    const a = computeContentHash('Same title', 'Same body text');
    const b = computeContentHash('Same title', 'Same body text');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when title differs', () => {
    const a = computeContentHash('Title A', 'Same body');
    const b = computeContentHash('Title B', 'Same body');
    expect(a).not.toBe(b);
  });

  it('differs when body differs', () => {
    const a = computeContentHash('Same title', 'Body A');
    const b = computeContentHash('Same title', 'Body B');
    expect(a).not.toBe(b);
  });

  it('is case-sensitive', () => {
    const a = computeContentHash('Title', 'body');
    const b = computeContentHash('title', 'body');
    expect(a).not.toBe(b);
  });

  it('handles empty title and body', () => {
    const hash = computeContentHash('', '');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
