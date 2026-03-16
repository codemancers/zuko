export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'currency'
  | 'select'
  | 'multiselect'
  | 'relation'
  | 'entity';

export type DataType = 'text' | 'number' | 'boolean' | 'date' | 'json';

export type ColumnRender = 'link' | 'badge' | 'email' | 'phone' | 'entity';

export type ColumnFormat = 'date' | 'currency' | 'owner' | 'stage';

export interface CellValue<T> {
  value: T;
  display: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface RelationConfig {
  entity: 'user' | 'company' | 'contact' | 'deal';
  labelField?: string;
}

export interface ColumnConfig {
  entityType?: 'company' | 'contact' | 'deal' | 'team' | 'member';
  useAvatar?: boolean;
  avatarSrcField?: string;
  accessorKey?: string;
  hrefTemplate?: string; // for links/urls
  currency?: string;
  dateFormat?: string;
  icon?: string;
  colorMap?: Record<string, string>; // for badges
  format?: ColumnFormat;
  options?: SelectOption[]; // for select dropdown fields
  relation?: RelationConfig; // for relation fields
  render?: ColumnRender; // additional rendering login on default field types
}

export interface ColumnMetadata {
  id: string;
  header: string;
  fieldType: ColumnType;
  dataType: DataType;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  editable?: boolean;
  isVisible?: boolean;
  width?: number;
  default?: boolean;
  config?: ColumnConfig;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TableViewResponse<T = Record<string, unknown>> {
  data: T[];
  metadata: ColumnMetadata[];
  pagination: PaginationInfo;
}
