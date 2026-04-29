/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BaseTable } from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

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
  icon: ({ className }: { className?: string }) => (
    <div data-testid="empty-icon" className={className} />
  ),
  title: 'No Data',
  description: 'Nothing to see here.',
  action: {
    label: 'Add New',
    onClick: vi.fn(),
  },
};

describe('BaseTable', () => {
  it('renders loading state', () => {
    renderWithQuery(
      <BaseTable
        columns={mockColumns}
        data={[]}
        loading={true}
        entityName="items"
        emptyStateConfig={mockEmptyStateConfig}
      />,
    );

    expect(screen.getByText(/Loading items.../i)).toBeInTheDocument();
  });

  it('renders table structure even when data is empty', () => {
    renderWithQuery(
      <BaseTable
        columns={mockColumns}
        data={[]}
        loading={false}
        emptyStateConfig={mockEmptyStateConfig}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();

    // Check for empty body
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);
  });

  it('renders data table correctly', () => {
    renderWithQuery(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        emptyStateConfig={mockEmptyStateConfig}
      />,
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
    renderWithQuery(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        onRowClick={onRowClick}
        emptyStateConfig={mockEmptyStateConfig}
      />,
    );

    fireEvent.click(screen.getByText('John Doe'));
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('renders pagination info when totalCount is provided', () => {
    renderWithQuery(
      <BaseTable
        columns={mockColumns}
        data={mockData}
        loading={false}
        totalCount={100}
        entityName="people"
        emptyStateConfig={mockEmptyStateConfig}
      />,
    );

    expect(screen.getByText('Showing 2 of 100 people')).toBeInTheDocument();
  });

  describe('Add Row Feature', () => {
    it('renders the add row button when showAddRow is true', () => {
      const onAddRow = vi.fn();
      renderWithQuery(
        <BaseTable
          columns={mockColumns}
          data={mockData}
          loading={false}
          showAddRow={true}
          onAddRow={onAddRow}
          emptyStateConfig={mockEmptyStateConfig}
        />,
      );

      const addButton = screen.getByRole('button', { name: /Add row/i });
      expect(addButton).toBeInTheDocument();

      fireEvent.click(addButton);
      expect(onAddRow).toHaveBeenCalled();
    });
  });

  describe('Add Column Feature', () => {
    it('renders the add column trigger in the header when showAddColumn is true', () => {
      renderWithQuery(
        <BaseTable
          columns={mockColumns}
          data={mockData}
          loading={false}
          showAddColumn={true}
          emptyStateConfig={mockEmptyStateConfig}
        />,
      );

      const addColumnButton = screen.getByRole('button', {
        name: /Add column/i,
      });
      expect(addColumnButton).toBeInTheDocument();
    });

    it('opens the Add Column dialog when the header trigger is clicked', () => {
      const onAddColumn = vi.fn();
      renderWithQuery(
        <BaseTable
          columns={mockColumns}
          data={mockData}
          loading={false}
          showAddColumn={true}
          onAddColumn={onAddColumn}
          emptyStateConfig={mockEmptyStateConfig}
        />,
      );

      const headerPlusButton = screen.getByRole('button', {
        name: /Add column/i,
      });
      fireEvent.click(headerPlusButton);

      expect(screen.getByText('Add new field')).toBeInTheDocument();
      expect(screen.getByText('Field Name')).toBeInTheDocument();
    });
  });
});
