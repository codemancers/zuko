export type ColumnType = 
  | 'text' 
  | 'badge' 
  | 'date' 
  | 'currency' 
  | 'link' 
  | 'entity';

export type ColumnFormat = 
  | 'date' 
  | 'currency' 
  | 'owner' 
  | 'stage';

export interface CellValue<T> {
  value: T;
  display: string;
}

export interface ColumnMetadata {
  id: string;
  header: string;
  type: ColumnType;
  sortable?: boolean;
  isVisible?: boolean;
  config?: {
    colorMap?: Record<string, string>;
    hrefTemplate?: string;
    entityType?: 'company' | 'contact' | 'deal';
    currency?: string;
    dateFormat?: string;
    icon?: string;
    accessorKey?: string;
    format?: ColumnFormat;
  };
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TableViewResponse<T> {
  data: T[];
  metadata: ColumnMetadata[];
  pagination: PaginationInfo;
}

export interface TableViewCompany {
  id: number;
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  owners: string;
  createdAt: CellValue<string>;
}

export interface TableViewContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  owners: string;
  createdAt: CellValue<string>;
}

export interface TableViewDeal {
  id: number;
  title: string;
  value: CellValue<number>;
  stage: CellValue<string>;
  probability?: number | string;
  owners: string;
  expectedCloseDate: CellValue<string>;
  createdAt: CellValue<string>;
}
