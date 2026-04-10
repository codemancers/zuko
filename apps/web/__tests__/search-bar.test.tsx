import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '@/components/shared/SearchBar';
import { describe, it, expect, vi } from 'vitest';

describe('SearchBar', () => {
  it('renders correctly with placeholder', () => {
    const onChange = vi.fn();
    render(
      <SearchBar value="" onChange={onChange} placeholder="Search deals..." />,
    );

    expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} placeholder="Search..." />);

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onChange).toHaveBeenCalledWith('test');
  });
});
