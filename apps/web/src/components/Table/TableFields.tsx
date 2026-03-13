'use client';

import type { ReactNode } from 'react';
import { Badge, Link } from '@zuko/ui-kit';
import { 
  BuildingOfficeIcon, 
  UserIcon, 
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { type ColumnMetadata, type BaseRow } from './types';


export interface FieldProps<T extends BaseRow = BaseRow> {
  value: unknown; 
  display?: string | null;
  metadata: ColumnMetadata;
  row: T;
}

export function TextField({ value, display, metadata, row }: FieldProps<BaseRow>) {
  const content = display ?? (value as ReactNode) ?? '';
  const renderConfig = metadata.config?.render;

  if (renderConfig === 'link') {
    let href = metadata.config?.hrefTemplate ?? '#';

    if (href.includes('{id}')) {
      href = href.replace('{id}', String(row.id));
    }

    if (href.includes('{value}')) {
      href = href.replace('{value}', String(value));
    }

    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </Link>
    );
  }

  if (renderConfig === 'badge') {
    const color = metadata.config?.colorMap?.[String(value)] || 'zinc';

    return (
      <Badge color={color as any} className="text-xs">
        {content}
      </Badge>
    );
  }

  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">
      {content}
    </span>
  );
}

export function EntityField({ value, display, metadata, row }: FieldProps<BaseRow>) {
  const entityType = metadata.config?.entityType;
  
  let Icon = BuildingOfficeIcon;
  let linkTarget = `#`;
  let displayText = display ?? value ?? row.name;

  if(entityType === 'company') {
    Icon = BuildingOfficeIcon;
    linkTarget = `/companies/${row.id}`;
    displayText = display ?? value ?? row.companyName;
  } else if (entityType === 'contact') {
    Icon = UserIcon;
    linkTarget = `/contacts/${row.id}`;
    displayText = display ?? value ?? row.name;
  } else if (entityType === 'deal') {
    Icon = BriefcaseIcon;
    linkTarget = `/deals/${row.id}`;
    displayText = display ?? value ?? row.title;
  }

  if (metadata.config?.hrefTemplate) {
    linkTarget = metadata.config.hrefTemplate.replace('{id}', String(row.id));
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div>
        <Link 
          href={linkTarget}
          className="font-medium text-zinc-950 dark:text-white hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayText as ReactNode}
        </Link>
      </div>
    </div>
  );
};

export function DateField({ value, display }: FieldProps<BaseRow>) {
  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">
      {(display ?? (value as ReactNode)) ?? ''}
    </span>
  );
};

export function CurrencyField({ value, display }: FieldProps<BaseRow>) {
  return <span className="text-sm text-zinc-600 dark:text-zinc-400">{(display ?? (value as ReactNode)) ?? ''}</span>;
}

// Registry of field components
export const FieldRegistry: Record<string, (props: FieldProps<BaseRow>) => ReactNode> = {
  text: TextField,
  date: DateField,
  currency: CurrencyField,
  entity: EntityField,
};

export function DataField(props: FieldProps) {
  // fallback to default as TextField
  const Component = FieldRegistry[props.metadata.fieldType] || TextField;
  return <Component {...props} />;
};
