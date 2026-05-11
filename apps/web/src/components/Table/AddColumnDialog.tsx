'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  Button,
  Input,
  Select,
  Field,
  Label,
  ErrorMessage,
  Combobox,
  ComboboxOption,
  ComboboxLabel,
  ComboboxDescription,
  Text,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { metadataApi } from '@/lib/api';
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import type { ColumnConfig } from '@/types/table-metadata';

interface AddColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    name: string,
    key: string,
    type: string,
    config?: ColumnConfig,
  ) => void;
}

export function AddColumnDialog({
  isOpen,
  onClose,
  onAdd,
}: AddColumnDialogProps) {
  const [fieldName, setFieldName] = useState('');
  const [columnKey, setColumnKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [options, setOptions] = useState<string[]>(['']);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validKeyRegex = /^[a-z0-9_]+$/;

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: metadataApi.getCurrencies,
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fieldName.trim()) {
      newErrors.fieldName = 'Field name is required';
    }
    if (!columnKey.trim()) {
      newErrors.columnKey = 'Column key is required';
    }
    if (!fieldType) {
      newErrors.fieldType = 'Field type is required';
    }
    if (columnKey && !validKeyRegex.test(columnKey)) {
      newErrors.columnKey =
        'Column key must contain only lowercase letters, numbers, and underscores';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onCloseDialog = () => {
    setFieldName('');
    setColumnKey('');
    setFieldType('text');
    setOptions(['']);
    setCurrencyCode('USD');
    setErrors({});
    onClose();
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      setOptions(['']);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAdd = () => {
    if (validate()) {
      let config: ColumnConfig | undefined = undefined;

      if (fieldType === 'select' || fieldType === 'multiselect') {
        const validOptions = options
          .filter((opt) => opt.trim() !== '')
          .map((opt) => ({ label: opt.trim(), value: opt.trim() }));

        if (validOptions.length > 0) {
          config = { options: validOptions };
        }
      }

      if (fieldType === 'currency') {
        config = { currency: currencyCode.trim().toUpperCase() || 'USD' };
      }

      onAdd(fieldName, columnKey, fieldType, config);
      setFieldName('');
      setColumnKey('');
      setFieldType('text');
      setOptions(['']);
      setCurrencyCode('USD');
      setErrors({});
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onClose={onClose} side="right">
      <SheetHeader>
        <SheetTitle>Add new field</SheetTitle>
        <Button plain onClick={onCloseDialog}>
          <XMarkIcon className="h-5 w-5" />
        </Button>
      </SheetHeader>

      <SheetBody className="space-y-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choose a field name, unique key and type for your new column.
        </p>
        <Field>
          <Label>Field Name</Label>
          <Input
            placeholder="Field name"
            value={fieldName}
            onChange={(e) => {
              setFieldName(e.target.value);
              if (errors.fieldName) setErrors({ ...errors, fieldName: '' });
            }}
            invalid={!!errors.fieldName}
          />
          {errors.fieldName && <ErrorMessage>{errors.fieldName}</ErrorMessage>}
        </Field>
        <Field>
          <Label>Column Key</Label>
          <Input
            placeholder="Unique column key (e.g. favorite_color)"
            value={columnKey}
            onChange={(e) => {
              setColumnKey(e.target.value);
              if (errors.columnKey) setErrors({ ...errors, columnKey: '' });
            }}
            invalid={!!errors.columnKey}
          />
          {errors.columnKey && <ErrorMessage>{errors.columnKey}</ErrorMessage>}
        </Field>
        <Field>
          <Label>Field Type</Label>
          <Select
            value={fieldType}
            onChange={(e) => {
              setFieldType(e.target.value);
              if (errors.fieldType) setErrors({ ...errors, fieldType: '' });
            }}
          >
            <option value="text">Single line text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="currency">Currency</option>
            <option value="select">Select</option>
            <option value="multiselect">Multi-select</option>
          </Select>
          {errors.fieldType && <ErrorMessage>{errors.fieldType}</ErrorMessage>}
        </Field>

        {fieldType === 'currency' && (
          <Field>
            <Label>Currency Code</Label>
            <Combobox
              options={currencies}
              value={currencies.find((c) => c.code === currencyCode) || null}
              onChange={(value) => {
                if (value) setCurrencyCode(value.code);
              }}
              displayValue={(value) => value?.code}
              placeholder="Search currency..."
            >
              {(currency) => (
                <ComboboxOption key={currency.code} value={currency}>
                  <ComboboxLabel>{currency.code}</ComboboxLabel>
                  <ComboboxDescription>{currency.name}</ComboboxDescription>
                  <Text className="ml-2">({currency.symbol})</Text>
                </ComboboxOption>
              )}
            </Combobox>
          </Field>
        )}

        {(fieldType === 'select' || fieldType === 'multiselect') && (
          <Field>
            <Label>Options</Label>
            <div data-slot="control" className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2 group">
                  <Input
                    placeholder="Option value"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    plain
                    onClick={() => handleRemoveOption(index)}
                    className="p-1"
                  >
                    <XMarkIcon className="h-4 w-4 text-zinc-400" />
                  </Button>
                </div>
              ))}
              <Button
                plain
                onClick={handleAddOption}
                className="mt-1 !h-8 text-xs !flex !items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                <span>Add option</span>
              </Button>
            </div>
          </Field>
        )}
      </SheetBody>

      <SheetFooter>
        <Button plain onClick={onCloseDialog}>
          Cancel
        </Button>
        <Button onClick={handleAdd}>Create field</Button>
      </SheetFooter>
    </Sheet>
  );
}
