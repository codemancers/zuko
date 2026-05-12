'use client';

export const EMPTY_VALUE = '—';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Link,
  Avatar,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@zuko/ui-kit';
import { type ColumnMetadata, type BaseRow } from './types';

type RowWithEntityFields = BaseRow & {
  name?: string;
  companyName?: string;
  title?: string;
};

export interface FieldProps<T extends BaseRow = BaseRow> {
  value: unknown;
  display?: string | null;
  metadata: ColumnMetadata;
  row: T;
}

export function TextField({
  value,
  display,
  metadata,
  row,
}: FieldProps<BaseRow>) {
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

  if (renderConfig === 'platform-icon') {
    const iconSrc = metadata.config?.iconMap?.[String(value)];
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {iconSrc && (
          <Image
            src={iconSrc}
            alt={String(content)}
            width={16}
            height={16}
            className="shrink-0 grayscale"
          />
        )}
        <span>{content}</span>
      </div>
    );
  }

  if (renderConfig === 'join-button') {
    if (!value) return null;
    return (
      <Link
        href={String(value)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <Badge
          color="blue"
          className="inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
          Join
        </Badge>
      </Link>
    );
  }

  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">{content}</span>
  );
}

export function EntityField<T extends BaseRow>({
  value,
  display,
  metadata,
  row,
}: FieldProps<T>) {
  const rowWithEntityField = row as T & RowWithEntityFields;
  const entityType = metadata.config?.entityType;

  let linkTarget: string | undefined = '#';
  let displayText = display ?? value ?? rowWithEntityField.name;

  if (entityType === 'company') {
    linkTarget = `/companies/${row.id}`;
    displayText = display ?? value ?? rowWithEntityField.companyName;
  } else if (entityType === 'contact') {
    linkTarget = `/contacts/${row.id}`;
    displayText = display ?? value ?? rowWithEntityField.name;
  } else if (entityType === 'deal') {
    linkTarget = `/deals/${row.id}`;
    displayText = display ?? value ?? rowWithEntityField.title;
  } else if (entityType === 'team') {
    linkTarget = undefined; // Team names are simple text
    displayText = display ?? (value as string);
  } else if (entityType === 'member') {
    linkTarget = undefined; // Member names are simple text
    displayText = display ?? (value as string);
  }

  if (metadata.config?.hrefTemplate) {
    linkTarget = metadata.config.hrefTemplate.replace('{id}', String(row.id));
  }

  return (
    <div className="flex items-center">
      <div className="flex shrink-0">
        {metadata.config?.useAvatar && metadata.config.avatarSrcField ? (
          <Avatar
            src={metadata.config.avatarSrcField}
            initials={(displayText as string)
              ?.split(/[\s.@]+/)
              .filter(Boolean)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
            className="size-6 bg-zinc-200 dark:bg-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 ring-1 ring-white dark:ring-zinc-900"
          />
        ) : null}
      </div>
      <div className="text-sm font-medium text-zinc-950 dark:text-white">
        {linkTarget && linkTarget !== '#' ? (
          <Link
            href={linkTarget}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {displayText as ReactNode}
          </Link>
        ) : (
          (displayText as ReactNode)
        )}
      </div>
    </div>
  );
}

export function DateField({ value, display }: FieldProps<BaseRow>) {
  let content: ReactNode = '';
  if (display) {
    content = display;
  } else if (value instanceof Date) {
    content = value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } else if (value !== null && value !== undefined) {
    content = value as ReactNode;
  }
  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">{content}</span>
  );
}

export function CurrencyField({
  value,
  display,
  metadata,
}: FieldProps<BaseRow>) {
  if (display) {
    return (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {display}
      </span>
    );
  }

  const numValue =
    typeof value === 'number'
      ? value
      : value !== null && value !== undefined
        ? Number(value)
        : null;

  if (numValue === null || Number.isNaN(numValue)) {
    return <span className="text-sm text-zinc-400">{EMPTY_VALUE}</span>;
  }

  const currency = metadata.config?.currency ?? 'USD';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numValue);

  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">
      {formatted}
    </span>
  );
}

export function SelectField({ value, display, metadata }: FieldProps<BaseRow>) {
  const options = metadata.config?.options ?? [];
  const label = options.find((o) => o.value === String(value))?.label;
  const content = display ?? label ?? (value as ReactNode) ?? '';
  const renderConfig = metadata.config?.render;

  if (renderConfig === 'badge') {
    const color = metadata.config?.colorMap?.[String(value)] || 'zinc';
    return (
      <Badge color={color as any} className="text-xs">
        {content}
      </Badge>
    );
  }

  return (
    <span className="text-sm text-zinc-600 dark:text-zinc-400">{content}</span>
  );
}

export function MultiSelectField({ value, metadata }: FieldProps<BaseRow>) {
  const values = Array.isArray(value)
    ? (value as string[])
    : value
      ? [String(value)]
      : [];
  const options = metadata.config?.options ?? [];

  const getLabel = (val: string) =>
    options.find((o) => o.value === val)?.label ?? val;
  const getColor = (val: string): string =>
    metadata.config?.colorMap?.[val] ?? 'zinc';

  if (values.length === 0) {
    return <span className="text-sm text-zinc-400">{EMPTY_VALUE}</span>;
  }

  const MAX_VISIBLE = 2;
  const visibleValues = values.slice(0, MAX_VISIBLE);
  const remainingCount = values.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
      {visibleValues.map((val) => (
        <Badge
          key={val}
          color={getColor(val) as any}
          className="text-[10px] py-0.5 px-1.5 truncate max-w-[100px]"
        >
          {getLabel(val)}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              color="zinc"
              className="text-[10px] py-0.5 px-1.5 shrink-0 cursor-default"
            >
              +{remainingCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-1">
              {values.slice(MAX_VISIBLE).map((val) => (
                <div key={val}>{getLabel(val)}</div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// Registry of field components
export const FieldRegistry: Record<
  string,
  (props: FieldProps<BaseRow>) => ReactNode
> = {
  text: TextField,
  date: DateField,
  currency: CurrencyField,
  entity: EntityField,
  select: SelectField,
  multiselect: MultiSelectField,
};

export function DataField(props: FieldProps) {
  // fallback to default as TextField
  const Component = FieldRegistry[props.metadata.fieldType] || TextField;
  return <Component {...props} />;
}
