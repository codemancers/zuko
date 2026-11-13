import { readSorting } from './sorting';

const params = (query: string) => new URLSearchParams(query);

describe('readSorting', () => {
  it('is unsorted without a sort param', () => {
    expect(readSorting(params(''))).toEqual([]);
  });

  it('reads ascending by default', () => {
    expect(readSorting(params('sort=name'))).toEqual([{ id: 'name', desc: false }]);
  });

  it('reads descending', () => {
    expect(readSorting(params('sort=email&order=desc'))).toEqual([{ id: 'email', desc: true }]);
  });

  it('treats an unknown order as ascending', () => {
    expect(readSorting(params('sort=role&order=sideways'))).toEqual([{ id: 'role', desc: false }]);
  });

  it('ignores columns the sheet cannot sort by', () => {
    expect(readSorting(params('sort=actions'))).toEqual([]);
    expect(readSorting(params('sort=__proto__'))).toEqual([]);
  });
});
