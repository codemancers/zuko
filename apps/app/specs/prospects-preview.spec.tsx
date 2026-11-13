import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProspectsPreview } from '../src/components/prospects/prospects-preview';

afterEach(cleanup);

it('renders a spreadsheet with named columns even before adding prospects', () => {
  render(<ProspectsPreview />);
  expect(screen.getByRole('table')).toBeTruthy();
  for (const name of ['Name', 'Company', 'LinkedIn', 'Actions']) {
    expect(
      screen.getByRole('columnheader', { name: new RegExp(`^${name} Resize ${name}$`) }),
    ).toBeTruthy();
  }
  addProspect();
  fireEvent.click(screen.getByRole('button', { name: 'Back to prospects' }));
  expect(screen.getByRole('cell', { name: 'Example Company' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View Preview Person' }));
  expect(screen.getByRole('heading', { name: 'Preview Person' })).toBeTruthy();
});

function addProspect(
  name = 'Preview Person',
  company = 'Example Company',
  slug = 'preview-person',
) {
  fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
  fillProspect(name, company, slug);
  fireEvent.click(screen.getByRole('button', { name: 'Add to preview' }));
}

function fillProspect(
  name = 'Preview Person',
  company = 'Example Company',
  slug = 'preview-person',
) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: company } });
  fireEvent.change(screen.getByLabelText('LinkedIn URL'), {
    target: { value: `https://www.linkedin.com/in/${slug}` },
  });
}

it('adds a temporary prospect and shows its details without claiming persistence', () => {
  render(<ProspectsPreview />);
  expect(screen.getByText(/Changes stay in this page only/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'No prospects in this preview yet' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
  fillProspect();
  fireEvent.click(screen.getByRole('button', { name: 'Add to preview' }));
  expect(screen.getByRole('heading', { name: 'Preview Person' })).toBeTruthy();
  expect(screen.getByText('Example Company')).toBeTruthy();
  expect(screen.getByRole('link', { name: /View LinkedIn profile/ }).getAttribute('href')).toBe(
    'https://www.linkedin.com/in/preview-person',
  );
});

it('edits a prospect in place and cancelling a later edit leaves it unchanged', () => {
  render(<ProspectsPreview />);
  addProspect();
  fireEvent.click(screen.getByRole('button', { name: 'Edit prospect' }));
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Preview Person');
  fillProspect('Updated Person', 'New Company', 'updated-person');
  fireEvent.click(screen.getByRole('button', { name: 'Apply to preview' }));
  expect(screen.getByRole('heading', { name: 'Updated Person' })).toBeTruthy();
  expect(screen.getByText('New Company')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Edit prospect' }));
  fillProspect('Discarded Person');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: 'Updated Person' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back to prospects' }));
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  expect(screen.getByText('Updated Person')).toBeTruthy();
  expect(screen.queryByText('Discarded Person')).toBeNull();
});

it.each([
  'javascript:alert(1)',
  'https://linkedin.com.evil.example/in/person',
  'https://example.com/in/person',
  'https://www.linkedin.com/company/example',
  'http://linkedin.com/in/person',
  'https://someone@linkedin.com/in/person',
])('rejects unsafe or non-profile URL %s without losing the draft', (url) => {
  render(<ProspectsPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
  fillProspect();
  fireEvent.change(screen.getByLabelText('LinkedIn URL'), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to preview' }));
  expect(screen.getByRole('alert').textContent).toContain('Use an HTTPS LinkedIn profile URL');
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Preview Person');
  expect((screen.getByLabelText('LinkedIn URL') as HTMLInputElement).value).toBe(url);
  expect(screen.getByLabelText('LinkedIn URL').getAttribute('aria-invalid')).toBe('true');
});

it('rejects blank names and companies, then accepts corrected and trimmed details', () => {
  render(<ProspectsPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
  fillProspect('   ', '   ');
  fireEvent.click(screen.getByRole('button', { name: 'Add to preview' }));
  expect(screen.getByText('Enter a name.')).toBeTruthy();
  expect(screen.getByText('Enter a company.')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  fillProspect('  Preview Person  ', '  Example Company  ');
  fireEvent.click(screen.getByRole('button', { name: 'Add to preview' }));
  expect(screen.getByRole('heading', { name: 'Preview Person' }).textContent).toBe(
    'Preview Person',
  );
});

it('paginates the preview and searches names or companies across all pages', () => {
  render(<ProspectsPreview />);
  for (let index = 1; index <= 6; index++) {
    addProspect(
      `Person ${index}`,
      index === 6 ? 'Other Company' : 'Example Company',
      `person-${index}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to prospects' }));
  }
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Person 6')).toBeTruthy();
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Search prospects'), { target: { value: '  EXAMPLE  ' } });
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
  expect(screen.queryByText('Person 6')).toBeNull();
  fireEvent.change(screen.getByLabelText('Search prospects'), { target: { value: 'person 6' } });
  expect(screen.getByText('Person 6')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search prospects'), { target: { value: 'no match' } });
  expect(screen.getByRole('heading', { name: 'No matching prospects' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
});

it('cancels a new draft and discards all preview records on remount', () => {
  const { unmount } = render(<ProspectsPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
  fillProspect();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: 'No prospects in this preview yet' })).toBeTruthy();
  addProspect();
  unmount();
  render(<ProspectsPreview />);
  expect(screen.getByRole('heading', { name: 'No prospects in this preview yet' })).toBeTruthy();
  expect(screen.queryByText('Preview Person')).toBeNull();
});
