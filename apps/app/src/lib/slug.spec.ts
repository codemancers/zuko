import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Acme Inc')).toBe('acme-inc');
  });

  it('collapses runs of punctuation and spaces into one hyphen', () => {
    expect(slugify('Acme,   Inc. & Co!!')).toBe('acme-inc-co');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Acme--  ')).toBe('acme');
  });

  it('keeps digits', () => {
    expect(slugify('C9S Inc 2')).toBe('c9s-inc-2');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('  !!! ')).toBe('');
    expect(slugify('日本語')).toBe('');
  });
});
