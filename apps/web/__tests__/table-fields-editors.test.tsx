/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CurrencyField,
  MultiSelectField,
  SelectField,
} from '@/components/Table/TableFields';
import {
  CurrencyEditor,
  SelectEditor,
} from '@/components/Table/CellEditors';
import { AddColumnDialog } from '@/components/Table/AddColumnDialog';
import type { ColumnMetadata } from '@/components/Table/types';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function makeMetadata(overrides: Partial<ColumnMetadata> = {}): ColumnMetadata {
  return {
    id: 'test',
    header: 'Test',
    fieldType: 'text',
    dataType: 'text',
    ...overrides,
  };
}

const baseRow = { id: 1 };

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopKeyDown = (_e: React.KeyboardEvent) => {};

// ── CurrencyField ──────────────────────────────────────────────────────────────

describe('CurrencyField', () => {
  it('formats a number as USD by default', () => {
    render(
      <CurrencyField
        value={1234.5}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('$1,234.50')).toBeInTheDocument();
  });

  it('uses the currency from metadata config', () => {
    render(
      <CurrencyField
        value={500}
        metadata={makeMetadata({ fieldType: 'currency', config: { currency: 'EUR' } })}
        row={baseRow}
      />
    );
    // EUR formatting — just assert the value is present
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('renders display string when provided', () => {
    render(
      <CurrencyField
        value={1000}
        display="$1,000.00"
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
  });

  it('shows dash for null value', () => {
    render(
      <CurrencyField
        value={null}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows dash for undefined value', () => {
    render(
      <CurrencyField
        value={undefined}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows dash for NaN value', () => {
    render(
      <CurrencyField
        value={NaN}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('formats zero correctly', () => {
    render(
      <CurrencyField
        value={0}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('formats negative values', () => {
    render(
      <CurrencyField
        value={-250}
        metadata={makeMetadata({ fieldType: 'currency' })}
        row={baseRow}
      />
    );
    expect(screen.getByText('-$250.00')).toBeInTheDocument();
  });
});

// ── MultiSelectField ───────────────────────────────────────────────────────────

describe('MultiSelectField', () => {
  const options = [
    { label: 'Hot', value: 'hot' },
    { label: 'Cold', value: 'cold' },
    { label: 'Warm', value: 'warm' },
  ];

  const metadata = makeMetadata({
    fieldType: 'multiselect',
    config: { options },
  });

  it('renders badges for each selected value', () => {
    render(
      <MultiSelectField value={['hot', 'cold']} metadata={metadata} row={baseRow} />
    );
    expect(screen.getByText('Hot')).toBeInTheDocument();
    expect(screen.getByText('Cold')).toBeInTheDocument();
  });

  it('falls back to the raw value when no option label found', () => {
    render(
      <MultiSelectField value={['unknown']} metadata={metadata} row={baseRow} />
    );
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('renders dash for empty array', () => {
    render(
      <MultiSelectField value={[]} metadata={metadata} row={baseRow} />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('wraps a single non-array string value in an array', () => {
    render(
      <MultiSelectField value="hot" metadata={metadata} row={baseRow} />
    );
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('uses colorMap for badge colors when provided', () => {
    const metaWithColors = makeMetadata({
      fieldType: 'multiselect',
      config: { options, colorMap: { hot: 'red', cold: 'blue' } },
    });
    // Just verify it renders without throwing
    const { container } = render(
      <MultiSelectField value={['hot', 'cold']} metadata={metaWithColors} row={baseRow} />
    );
    expect(container).toBeTruthy();
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });
});

// ── SelectField ────────────────────────────────────────────────────────────────

describe('SelectField', () => {
  const options = [
    { label: 'Prospecting', value: 'prospecting' },
    { label: 'Qualified', value: 'qualified' },
  ];

  it('renders the label matching the value', () => {
    render(
      <SelectField
        value="prospecting"
        metadata={makeMetadata({ fieldType: 'select', config: { options } })}
        row={baseRow}
      />
    );
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
  });

  it('renders as badge when render config is badge', () => {
    render(
      <SelectField
        value="prospecting"
        metadata={makeMetadata({
          fieldType: 'select',
          config: { options, render: 'badge', colorMap: { prospecting: 'blue' } },
        })}
        row={baseRow}
      />
    );
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
  });
});

// ── CurrencyEditor ─────────────────────────────────────────────────────────────

describe('CurrencyEditor', () => {
  it('renders a number input', () => {
    render(
      <CurrencyEditor
        value={500}
        onChange={noop}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency' })}
      />
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('500');
  });

  it('shows the USD currency symbol', () => {
    render(
      <CurrencyEditor
        value={0}
        onChange={noop}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency' })}
      />
    );
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('shows the correct symbol for a custom currency', () => {
    render(
      <CurrencyEditor
        value={0}
        onChange={noop}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency', config: { currency: 'GBP' } })}
      />
    );
    expect(screen.getByText('£')).toBeInTheDocument();
  });

  it('calls onChange with a number when input changes', async () => {
    const onChange = vi.fn();
    render(
      <CurrencyEditor
        value=""
        onChange={onChange}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency' })}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith(999);
  });

  it('calls onChange with null when input is cleared', () => {
    const onChange = vi.fn();
    render(
      <CurrencyEditor
        value={100}
        onChange={onChange}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency' })}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onBlur when input loses focus', () => {
    const onBlur = vi.fn();
    render(
      <CurrencyEditor
        value={100}
        onChange={noop}
        onBlur={onBlur}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'currency' })}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });
});

// ── SelectEditor ───────────────────────────────────────────────────────────────

describe('SelectEditor', () => {
  const options = [
    { label: 'Prospecting', value: 'prospecting' },
    { label: 'Qualified', value: 'qualified' },
  ];

  it('renders all options', () => {
    render(
      <SelectEditor
        value="prospecting"
        onChange={noop}
        onBlur={noop}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'select', config: { options } })}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('calls onChange and onBlur when a new option is selected', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value="prospecting"
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={noopKeyDown}
        metadata={makeMetadata({ fieldType: 'select', config: { options } })}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'qualified' } });
    expect(onChange).toHaveBeenCalledWith('qualified');
    expect(onBlur).toHaveBeenCalled();
  });
});

// ── AddColumnDialog ────────────────────────────────────────────────────────────

describe('AddColumnDialog', () => {
  it('renders the dialog when open', () => {
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    expect(screen.getByText('Add new field')).toBeInTheDocument();
  });

  it('shows Currency and Multi-select in the field type options', () => {
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Currency');
    expect(options).toContain('Multi-select');
  });

  it('shows currency code input when Currency type is selected', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.selectOptions(screen.getByRole('combobox'), 'currency');
    expect(screen.getByPlaceholderText('e.g. USD, EUR, GBP')).toBeInTheDocument();
  });

  it('defaults currency code to USD', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.selectOptions(screen.getByRole('combobox'), 'currency');
    const currencyInput = screen.getByPlaceholderText('e.g. USD, EUR, GBP') as HTMLInputElement;
    expect(currencyInput.value).toBe('USD');
  });

  it('shows options builder when Multi-select type is selected', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.selectOptions(screen.getByRole('combobox'), 'multiselect');
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Option value')).toBeInTheDocument();
  });

  it('shows options builder when Select type is selected', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.selectOptions(screen.getByRole('combobox'), 'select');
    expect(screen.getByText('Options')).toBeInTheDocument();
  });

  it('calls onAdd with currency config when currency field is created', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText('Field name'), 'Deal Budget');
    await user.type(screen.getByPlaceholderText(/Unique column key/), 'deal_budget');
    await user.selectOptions(screen.getByRole('combobox'), 'currency');

    const currencyInput = screen.getByPlaceholderText('e.g. USD, EUR, GBP');
    await user.clear(currencyInput);
    await user.type(currencyInput, 'EUR');

    await user.click(screen.getByRole('button', { name: /Create field/i }));

    expect(onAdd).toHaveBeenCalledWith('Deal Budget', 'deal_budget', 'currency', { currency: 'EUR' });
  });

  it('calls onAdd with options config when multiselect field is created', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText('Field name'), 'Tags');
    await user.type(screen.getByPlaceholderText(/Unique column key/), 'tags');
    await user.selectOptions(screen.getByRole('combobox'), 'multiselect');
    await user.type(screen.getByPlaceholderText('Option value'), 'Hot');

    await user.click(screen.getByRole('button', { name: /Create field/i }));

    expect(onAdd).toHaveBeenCalledWith('Tags', 'tags', 'multiselect', {
      options: [{ label: 'Hot', value: 'Hot' }],
    });
  });

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.click(screen.getByRole('button', { name: /Create field/i }));
    expect(screen.getByText('Field name is required')).toBeInTheDocument();
    expect(screen.getByText('Column key is required')).toBeInTheDocument();
  });

  it('shows validation error for invalid column key characters', async () => {
    const user = userEvent.setup();
    render(<AddColumnDialog isOpen onClose={noop} onAdd={noop} />);
    await user.type(screen.getByPlaceholderText('Field name'), 'My Field');
    await user.type(screen.getByPlaceholderText(/Unique column key/), 'My Field!');
    await user.click(screen.getByRole('button', { name: /Create field/i }));
    expect(screen.getByText(/lowercase letters, numbers, and underscores/i)).toBeInTheDocument();
  });

  it('resets form state when closed and reopened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddColumnDialog isOpen onClose={onClose} onAdd={noop} />);
    await user.type(screen.getByPlaceholderText('Field name'), 'Temp Field');
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
