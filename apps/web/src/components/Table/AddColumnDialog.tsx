'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
  Button,
  Input,
  Select,
  Field,
  Label,
  ErrorMessage,
} from '@zuko/ui-kit';

interface AddColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, key: string, type: string) => void;
}

export function AddColumnDialog({ isOpen, onClose, onAdd }: AddColumnDialogProps) {
  const [fieldName, setFieldName] = useState('');
  const [columnKey, setColumnKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validKeyRegex = /^[a-z0-9_]+$/;

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
      newErrors.columnKey = 'Column key must contain only lowercase letters, numbers, and underscores';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onCloseDialog = () => {
    setFieldName('');
    setColumnKey('');
    setFieldType('text');
    setErrors({});
    onClose();
  };

  const handleAdd = () => {
    if (validate()) {
      onAdd(fieldName, columnKey, fieldType);
      setFieldName('');
      setColumnKey('');
      setFieldType('text');
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Add new field</DialogTitle>
      <DialogDescription>
        Choose a field name, unique key and type for your new column.
      </DialogDescription>
      <DialogBody className="space-y-4">
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
            <option value="boolean">Checkbox</option>
          </Select>
          {errors.fieldType && <ErrorMessage>{errors.fieldType}</ErrorMessage>}
        </Field>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onCloseDialog}>Cancel</Button>
        <Button onClick={handleAdd}>Create field</Button>
      </DialogActions>
    </Dialog>
  );
}
