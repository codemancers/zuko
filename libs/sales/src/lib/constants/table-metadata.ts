import { ColumnMetadata } from '../types/table-metadata';

export const COMPANY_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'companyName',
    header: 'Company',
    type: 'entity',
    sortable: true,
    config: {
      entityType: 'company',
      hrefTemplate: '/companies/{id}',
    },
  },
  {
    id: 'website',
    header: 'Website',
    type: 'link',
    sortable: true,
    config: {
      hrefTemplate: '{value}',
    },
  },
  {
    id: 'linkedinUrl',
    header: 'LinkedIn',
    type: 'link',
    sortable: false,
    config: {
      hrefTemplate: '{value}',
    },
  },
  {
    id: 'owners',
    header: 'Owner',
    type: 'text',
    sortable: false,
    config: {
      format: 'owner',
    },
  },
  {
    id: 'createdAt',
    header: 'Created',
    type: 'date',
    sortable: true,
    config: {
      format: 'date',
    },
  },
];

export const CONTACT_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'name',
    header: 'Name',
    type: 'entity',
    sortable: true,
    config: {
      entityType: 'contact',
      hrefTemplate: '/contacts/{id}',
    },
  },
  {
    id: 'email',
    header: 'Email',
    type: 'text',
    sortable: false,
    config: {
      accessorKey: 'email',
    },
  },
  {
    id: 'phone',
    header: 'Phone',
    type: 'text',
    sortable: false,
    config: {
      accessorKey: 'phone',
    },
  },
  {
    id: 'owners',
    header: 'Owner',
    type: 'text',
    sortable: false,
    config: {
      format: 'owner',
    },
  },
  {
    id: 'createdAt',
    header: 'Created',
    type: 'date',
    sortable: true,
    config: {
      format: 'date',
    },
  },
];

export const DEAL_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'title',
    header: 'Title',
    type: 'entity',
    sortable: true,
    config: {
      entityType: 'deal',
      hrefTemplate: '/deals/{id}',
    },
  },
  {
    id: 'value',
    header: 'Value',
    type: 'currency',
    sortable: true,
    config: {
      currency: 'USD',
      format: 'currency',
    },
  },
  {
    id: 'stage',
    header: 'Stage',
    type: 'badge',
    sortable: true,
    config: {
      format: 'stage',
      colorMap: {
        prospecting: 'zinc',
        qualification: 'blue',
        proposal: 'yellow',
        negotiation: 'yellow',
        closed_won: 'green',
        closed_lost: 'red',
      },
    },
  },
  {
    id: 'probability',
    header: 'Probability',
    type: 'text',
    sortable: true,
    config: {
      accessorKey: 'probability',
    },
  },
  {
    id: 'owners',
    header: 'Owner',
    type: 'text',
    sortable: false,
    config: {
      format: 'owner',
    },
  },
  {
    id: 'expectedCloseDate',
    header: 'Expected Close',
    type: 'date',
    sortable: true,
    config: {
      format: 'date',
    },
  },
];
