import { ReactNode, useState } from 'react';
import { Badge, Input, Combobox, ComboboxOption, ComboboxLabel, ComboboxDescription, Text } from '@zuko/ui-kit';
import { formatCurrency } from '@/lib/format-utils';
import dayjs from 'dayjs';
import { PlusIcon, ChevronUpIcon, PencilIcon } from '@heroicons/react/20/solid';

export type RenderType =
  | 'text'
  | 'link'
  | 'email'
  | 'phone'
  | 'currency'
  | 'badge'
  | 'date'
  | 'user';

export type EditType = 'text' | 'number' | 'select' | 'date' | 'textarea' | 'currency' | 'combobox';

export interface Property {
  label: string;
  value: any;
  renderType?: RenderType;
  fieldType?: EditType;
  onSave?: (value: any) => Promise<unknown> | unknown;
  placeholder?: string;
  isPrimary?: boolean; // New: explicitly mark as primary
  options?: {
    validation?: 'linkedin'; //special validations
    href?: string;
    currency?: string;
    badgeColor?: 'zinc' | 'blue' | 'green' | 'red' | 'yellow';
    dateFormat?: string;
    min?: number;
    max?: number;
    currencyOptions?: { code: string; symbol: string; name: string }[];
    selectOptions?: { value: any; label: string }[];
    comboboxOptions?: { value: any; label: string }[];
  };
}

function validateProperty(value: string, property: Property): string | null {
  // Number range validation
  if (property.fieldType === 'number') {
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number';
    const { min, max } = property.options ?? {};
    if ((min !== undefined && num < min) || (max !== undefined && num > max)) {
      return `Must be in range ${min ?? ''}–${max ?? ''}`;
    }
    return null;
  }

  // RenderType-based validation
  switch (property.renderType) {
    case 'link': {
      try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return 'Must be a valid URL (e.g., https://example.com)';
        }
        else if (property.options?.validation === 'linkedin') {
          if (!url.hostname.includes('linkedin.com')) {
            return 'Must be a valid LinkedIn URL';
          }
        }
        return null;
      } catch {
        return 'Must be a valid URL (e.g., https://example.com)';
      }
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Must be a valid email address';
      }
      return null;
    }
    case 'phone': {
      if (!/^\+[1-9]\d{1,14}$/.test(value)) {
        return 'Must be in E.164 format (e.g., +14155552671)';
      }
      return null;
    }
    default:
      return null;
  }
}

interface EntityPropertiesProps {
  properties: Property[];
  maxDisplay?: number;
}

export function EntityProperties({
  properties,
  maxDisplay = 5,
}: EntityPropertiesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Group by primary if specified, otherwise fallback to count
  const primaryProperties = properties.some((p) => p.isPrimary)
    ? properties.filter((p) => p.isPrimary)
    : properties.slice(0, maxDisplay);

  const secondaryProperties = properties.some((p) => p.isPrimary)
    ? properties.filter((p) => !p.isPrimary)
    : properties.slice(maxDisplay);

  const visibleProperties = isExpanded
    ? [...primaryProperties, ...secondaryProperties]
    : primaryProperties;

  const hasRemaining = secondaryProperties.length > 0;

  const handleEdit = (property: Property) => {
    if (!property.fieldType || !property.onSave) return;
    setEditingLabel(property.label);
    // For number fields, extract numeric value from display string (e.g. "50%" → "50")
    const rawValue = property.value ?? '';
    if (property.fieldType === 'currency') {
      setEditValue({ amount: rawValue, currency: property.options?.currency ?? 'USD' });
    } else if (property.fieldType === 'combobox') {
      // Reverse-map the display label back to the option value
      const match = property.options?.comboboxOptions?.find((o) => o.label === rawValue);
      setEditValue(match?.value ?? rawValue);
    } else {
      const editVal = property.fieldType === 'number' && typeof rawValue === 'string'
        ? rawValue.replace(/[^0-9.-]/g, '')
        : rawValue;
      setEditValue(editVal);
    }
    setValidationError(null);
  };

  const handleCancel = () => {
    setEditingLabel(null);
    setEditValue(null);
    setValidationError(null);
  };

  const handleSave = async (property: Property) => {
    if (!property.onSave || isSaving || editingLabel !== property.label) return;

    // Currency has its own save flow
    if (property.fieldType === 'currency') {
      const cv = editValue as { amount: any; currency: string };
      const amountStr = typeof cv?.amount === 'string' ? cv.amount.trim() : String(cv?.amount ?? '');

      if (amountStr && (isNaN(Number(amountStr)) || Number(amountStr) < 0)) {
        setValidationError('Must be a positive number');
        return;
      }

      const newAmount = amountStr ? Number(amountStr) : 0;
      const newCurrency = cv?.currency ?? 'USD';
      if (newAmount === (property.value ?? 0) && newCurrency === (property.options?.currency ?? 'USD')) {
        handleCancel();
        return;
      }

      setIsSaving(true);
      try {
        await property.onSave({ value: newAmount, currency: newCurrency });
        setEditingLabel(null);
        setEditValue(null);
        setValidationError(null);
      } catch (error) {
        console.error('Failed to save property:', error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const trimmedValue = typeof editValue === 'string' ? editValue.trim() : editValue;

    // Run validation
    if (trimmedValue) {
      const error = validateProperty(trimmedValue, property);
      if (error) {
        setValidationError(error);
        return;
      }
    }

    // Check if value actually changed to avoid unnecessary API calls
    const isDate = property.fieldType === 'date';
    const currentValue = isDate
      ? (property.value ? dayjs(property.value).format('YYYY-MM-DD') : '')
      : (property.value ?? '');
    const newValue = isDate
      ? (trimmedValue ? dayjs(trimmedValue).format('YYYY-MM-DD') : '')
      : trimmedValue;

    if (currentValue === newValue) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      let valueToSave: any;
      if (isDate && trimmedValue) {
        valueToSave = new Date(trimmedValue).toISOString();
      } else if (property.fieldType === 'number' && trimmedValue) {
        valueToSave = Number(trimmedValue);
      } else {
        valueToSave = trimmedValue || null;
      }
      await property.onSave(valueToSave);
      setEditingLabel(null);
      setEditValue(null);
      setValidationError(null);
    } catch (error) {
      console.error('Failed to save property:', error);
      handleCancel();
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditor = (property: Property) => {
    switch (property.fieldType) {
      case 'date': {
        const formattedValue =
          editValue && !isNaN(new Date(editValue as string).getTime())
            ? new Date(editValue as string).toISOString().split('T')[0]
            : '';

        return (
          <Input
            type="date"
            variant="plain"
            autoFocus
            value={formattedValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(property)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') handleCancel();
            }}
            className="text-sm font-medium"
            disabled={isSaving}
          />
        );
      }
      case 'text': {
        return (
          <div className="flex flex-col">
            <Input
              type="text"
              variant="plain"
              autoFocus
              value={editValue ?? ''}
              onChange={(e) => {
                setEditValue(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onBlur={() => handleSave(property)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder={property.placeholder}
              className="text-sm font-medium"
              disabled={isSaving}
            />
            {validationError && (
              <span className="text-[11px] text-red-500 mt-1">{validationError}</span>
            )}
          </div>
        );
      }
      case 'number': {
        return (
          <div className="flex flex-col">
            <Input
              type="number"
              variant="plain"
              autoFocus
              value={editValue ?? ''}
              onChange={(e) => {
                setEditValue(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onBlur={() => handleSave(property)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder={property.placeholder}
              className="text-sm font-medium"
              disabled={isSaving}
            />
            {validationError && (
              <span className="text-[11px] text-red-500 mt-1">{validationError}</span>
            )}
          </div>
        );
      }
      case 'currency': {
        const currencyValue = editValue as { amount: any; currency: string } | null;
        const currencyOptions = property.options?.currencyOptions ?? [{ code: 'USD', symbol: '$', name: 'US Dollar' }];
        return (
          <div
            className="flex flex-col"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                handleSave(property);
              }
            }}
          >
            <div className="flex items-center gap-1">
              <Combobox
                options={currencyOptions}
                value={currencyOptions.find((c) => c.code === (currencyValue?.currency ?? 'USD')) || null}
                onChange={(value) => {
                  if (value) setEditValue({ ...currencyValue, currency: value.code });
                }}
                displayValue={(value) => value?.code}
                placeholder="Currency..."
                variant="plain"
                anchor="bottom start"
                className="!w-[80px]"
              >
                {(currency) => (
                  <ComboboxOption key={currency.code} value={currency}>
                    <ComboboxLabel>{currency.code}</ComboboxLabel>
                    <ComboboxDescription>{currency.name}</ComboboxDescription>
                    <Text className="ml-2">({currency.symbol})</Text>
                  </ComboboxOption>
                )}
              </Combobox>
              <Input
                type="number"
                variant="plain"
                autoFocus
                value={currencyValue?.amount ?? ''}
                onChange={(e) => {
                  setEditValue({ ...currencyValue, amount: e.target.value });
                  if (validationError) setValidationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                  if (e.key === 'Escape') handleCancel();
                }}
                placeholder={property.placeholder ?? '0'}
                className="text-sm font-medium"
                disabled={isSaving}
              />
            </div>
            {validationError && (
              <span className="text-[11px] text-red-500 mt-1">{validationError}</span>
            )}
          </div>
        );
      }
      case 'combobox': {
        const comboOptions = property.options?.comboboxOptions ?? [];
        const selectedOption = comboOptions.find((o) => String(o.value) === String(editValue)) || null;
        return (
          <div
            className="flex flex-col"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                handleCancel();
              }
            }}
          >
            <Combobox
              options={comboOptions}
              value={selectedOption}
              onChange={async (opt) => {
                if (opt && property.onSave) {
                  setIsSaving(true);
                  try {
                    await property.onSave(opt.value);
                    setEditingLabel(null);
                    setEditValue(null);
                    setValidationError(null);
                  } catch (error) {
                    console.error('Failed to save property:', error);
                  } finally {
                    setIsSaving(false);
                  }
                }
              }}
              displayValue={(opt) => opt?.label ?? ''}
              filter={(opt, query) => (opt?.label ?? '').toLowerCase().includes(query.toLowerCase())}
              placeholder={property.placeholder ?? 'Select...'}
              variant="plain"
              anchor="bottom start"
              autoFocus
              className="!w-[160px]"
            >
              {(option) => (
                <ComboboxOption key={option.value} value={option}>
                  <ComboboxLabel>{option.label}</ComboboxLabel>
                </ComboboxOption>
              )}
            </Combobox>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderValue = (property: Property) => {
    const { value, renderType, options, fieldType, onSave } = property;

    if (editingLabel === property.label) {
      return renderEditor(property);
    }

    const isEditable = fieldType && onSave;

    if (value === undefined || value === null || value === '') {
      return (
        <span
          className={
            isEditable
              ? 'text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors'
              : 'text-zinc-400'
          }
          onClick={() => isEditable && handleEdit(property)}
        >
          —
        </span>
      );
    }

    const content = (() => {
      switch (renderType) {
        case 'link':
          return (
            <a
              href={options?.href || value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {value}
            </a>
          );
        case 'email':
          return (
            <a
              href={`mailto:${value}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
              onClick={(e) => isEditable && e.stopPropagation()}
            >
              {value}
            </a>
          );
        case 'phone':
          return value;
        case 'currency':
          return formatCurrency(value, options?.currency);
        case 'badge':
          return (
            <Badge color={options?.badgeColor || 'zinc'} className="text-xs">
              {value}
            </Badge>
          );
        case 'date':
          return dayjs(value).format(options?.dateFormat || 'MMM D, YYYY');
        case 'user': {
          const users = Array.isArray(value) ? value : [value];
          const displayUsers = users.slice(0, 3);
          const remainingCount = users.length - 3;

          return (
            <div className="flex items-center">
              <div className="flex -space-x-2 overflow-hidden">
                {displayUsers.map((user, i) => {
                  const name = typeof user === 'string' ? user : user.name;
                  const initials =
                    name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase() || '?';

                  return (
                    <div
                      key={i}
                      title={name}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-zinc-50 ring-2 ring-white dark:bg-white dark:text-zinc-900 dark:ring-zinc-950"
                    >
                      {initials}
                    </div>
                  );
                })}
                {remainingCount > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-200 ring-2 ring-white dark:bg-zinc-200 dark:text-zinc-800 dark:ring-zinc-950">
                    +{remainingCount}
                  </div>
                )}
              </div>
              <span className="ml-2">
                {users.length === 1
                  ? typeof users[0] === 'string'
                    ? users[0]
                    : users[0].name
                  : `${users.length} Owners`}
              </span>
            </div>
          );
        }
        case 'text':
        default:
          return typeof value === 'object'
            ? (value as ReactNode)
            : String(value);
      }
    })();

    if (!isEditable) {
      return <>{content}</>;
    }

    return (
      <span
        className="inline-flex items-center gap-1.5 group/edit cursor-pointer"
        onClick={(e) => {
          // Don't trigger edit when clicking a link
          if ((e.target as HTMLElement).closest('a')) return;
          handleEdit(property);
        }}
      >
        {content}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(property);
          }}
          className="opacity-0 group-hover/edit:opacity-100 transition-opacity p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title="Edit"
        >
          <PencilIcon className="h-3 w-3 text-zinc-400" />
        </button>
      </span>
    );
  };

  return (
    <div className="mt-8 mb-8">
      <dl className="flex flex-wrap items-start gap-x-12 gap-y-8">
        {visibleProperties.map((property) => (
          <div key={property.label} className="flex flex-col gap-1.5 min-w-32">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {property.label}
            </dt>
            <dd className="text-sm font-medium text-zinc-950 dark:text-white min-h-[28px] flex items-center">
              {renderValue(property)}
            </dd>
          </div>
        ))}

        {hasRemaining && (
          <div className="flex items-center self-end pb-0.5">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="group flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
                  <span>More properties</span>
                  <span className="ml-0.5 rounded-full bg-zinc-200/50 px-1.5 py-0.5 text-[10px] dark:bg-zinc-700/50">
                    {secondaryProperties.length}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </dl>
    </div>
  );
}
