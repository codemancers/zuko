/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BaseTable } from '@/components/Table';
import { ColumnDef } from '@tanstack/react-table';

interface MockData {
  id: number;
  name: string;
  role: string;
}

const mockColumns: ColumnDef<MockData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'role',
    header: 'Role',
  },
];

const mockData: MockData[] = [
  { id: 1, name: 'John Doe', role: 'Admin' },
  { id: 2, name: 'Jane Smith', role: 'User' },
];

const mockEmptyStateConfig = {
  icon: ({ className }: { className?: string }) => <div data-testid="empty-icon" className={className} />,
  title: 'No Data',
  description: 'Nothing to see here.',
  action: {
    label: 'Add New',
    onClick: vi.fn(),
  },
};

describe('BaseTable', () => {
  it('renders loading state', () => {
    render(
      <BaseTable
        columns={mockColumns}
        data={[]}
        loading={true}
        entityName="items"
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    expect(screen.getByText(/Loading items.../i)).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(
      <BaseTable
        columns={mockColumns}
        data={[]}
        loading={false}
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('Nothing to see here.')).toBeInTheDocument();
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add New/i })).toBeInTheDocument();
  });

  it('calls action onClick in empty state', () => {
    render(
      <BaseTable
        columns={mockColumns}
        data={[]}
        loading={false}
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add New/i }));
    expect(mockEmptyStateConfig.action.onClick).toHaveBeenCalled();
  });

  it('renders data table correctly', () => {
    render(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    
    // Headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        onRowClick={onRowClick}
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    fireEvent.click(screen.getByText('John Doe'));
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('renders pagination info when totalCount is provided', () => {
    render(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        totalCount={100}
        entityName="people"
        emptyStateConfig={mockEmptyStateConfig}
      />
    );

    expect(screen.getByText('Showing 2 of 100 people')).toBeInTheDocument();
  });
});
