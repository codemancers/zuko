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
} from '@zuko/ui-kit';

interface AddColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, type: string) => void;
}

export function AddColumnDialog({ isOpen, onClose, onAdd }: AddColumnDialogProps) {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');

  const handleAdd = () => {
    if (fieldName) {
      onAdd(fieldName, fieldType);
      setFieldName('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Add new field</DialogTitle>
      <DialogDescription>
        Choose a field name and type for your new column.
      </DialogDescription>
      <DialogBody className="space-y-4">
        <div className="space-y-2 flex flex-col">
          <label className="text-sm font-medium text-zinc-950 dark:text-white">Field Name</label>
          <Input 
            placeholder="Field name" 
            value={fieldName} 
            onChange={(e) => setFieldName(e.target.value)} 
          />
        </div>
        <div className="space-y-2 flex flex-col">
          <label className="text-sm font-medium text-zinc-950 dark:text-white">Field Type</label>
          <Select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
          >
            <option value="text">Single line text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Checkbox</option>
          </Select>
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd}>Create field</Button>
      </DialogActions>
    </Dialog>
  );
}
