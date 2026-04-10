import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '@/components/shared/SearchBar';
import { describe, it, expect, vi } from 'vitest';

describe('SearchBar', () => {
  it('renders correctly with placeholder', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} placeholder="Search deals..." />);
    
    expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} placeholder="Search..." />);
    
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button only when there is a value', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBar value="" onChange={onChange} placeholder="Search..." />);
    
    // Should not show clear button
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    
    // Rerender with value
    rerender(<SearchBar value="hello" onChange={onChange} placeholder="Search..." />);
    
    // Should show clear button
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
    
    // Clicking clear should call onChange with empty string
    fireEvent.click(clearButton);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
