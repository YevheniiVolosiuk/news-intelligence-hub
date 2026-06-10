import {preFilter} from '../../src/common/utils/pre-filter';

describe('preFilter', () => {
  const healthyItem = {
    title: 'Breaking: AI transforms industry standards',
    content: 'A'.repeat(300),
  };

  it('returns pending for healthy content', () => {
    const result = preFilter(healthyItem);
    expect(result).toEqual({state: 'pending'});
  });

  // ── empty ──────────────────────────────────────────────────────

  it('returns filtered with reason "empty" when title and content are both empty', () => {
    expect(preFilter({title: '', content: ''})).toEqual({
      state: 'filtered',
      reason: 'empty',
    });
  });

  it('returns filtered with reason "empty" when both title and content are null', () => {
    expect(
      preFilter({title: null as unknown as string, content: null as unknown as string}),
    ).toEqual({state: 'filtered', reason: 'empty'});
  });

  it('returns filtered with reason "below-min-length" when content is null but title exists', () => {
    expect(preFilter({title: 'Some title', content: null as unknown as string})).toEqual({
      state: 'filtered',
      reason: 'below-min-length',
    });
  });

  // ── below-min-length ───────────────────────────────────────────

  it('returns filtered with reason "below-min-length" for short content', () => {
    const result = preFilter({
      title: 'Short article',
      content: 'A'.repeat(50),
    });
    expect(result).toEqual({state: 'filtered', reason: 'below-min-length'});
  });

  it('respects a custom minLength from config', () => {
    const result = preFilter(
      {title: 'Short article', content: 'A'.repeat(50)},
      {minLength: 30},
    );
    expect(result).toEqual({state: 'pending'});
  });

  // ── no-extractable-text ────────────────────────────────────────

  it('returns filtered with reason "no-extractable-text" when content is only HTML tags', () => {
    const result = preFilter({
      title: 'Has title',
      content: '<div><p></p><span></span></div>',
    });
    expect(result).toEqual({state: 'filtered', reason: 'no-extractable-text'});
  });

  it('returns filtered with reason "no-extractable-text" when content is only whitespace', () => {
    const result = preFilter({
      title: 'Has title',
      content: '   \n\t  \n   '.padEnd(300, ' '),
    });
    expect(result).toEqual({state: 'filtered', reason: 'no-extractable-text'});
  });

  // ── seo-boilerplate ────────────────────────────────────────────

  it('returns filtered with reason "seo-boilerplate" for cookie-consent text', () => {
    const cookieText = [
      'We use cookies to improve your experience.',
      'By continuing to use this site you accept our cookie policy.',
      'Manage your preferences below.',
    ].join(' ').padEnd(300, '.');

    const result = preFilter({title: 'Cookie Policy', content: cookieText});
    expect(result).toEqual({state: 'filtered', reason: 'seo-boilerplate'});
  });

  it('returns filtered with reason "seo-boilerplate" for keyword-stuffed content', () => {
    // Same short phrase repeated 10+ times
    const keywordText = 'best cheap loans best cheap loans '.repeat(15);
    const result = preFilter({title: 'Best Cheap Loans', content: keywordText});
    expect(result).toEqual({state: 'filtered', reason: 'seo-boilerplate'});
  });
});
