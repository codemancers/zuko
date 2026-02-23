import { render } from '@testing-library/react';

import SentinelsUiKit from './ui-kit';

describe('SentinelsUiKit', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SentinelsUiKit />);
    expect(baseElement).toBeTruthy();
  });
});
