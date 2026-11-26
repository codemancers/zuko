'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { api, ApiError } from '@/lib/api';
import {
  editFromField,
  FIELD_TYPE_LABELS,
  fieldPatchBody,
  type FieldDef,
  type FieldEdit,
} from '@/lib/records';

/** The form for one existing field. The key and type are shown but cannot be changed. */
function EditField({
  object,
  field,
  hasRecords,
  onClose,
  onChanged,
}: {
  object: string;
  field: FieldDef;
  hasRecords: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [edit, setEdit] = useState<FieldEdit>(() => editFromField(field));
  const [problem, setProblem] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const change = (changes: Partial<FieldEdit>) =>
    setEdit((current) => ({ ...current, ...changes }));
  const url = `/api/v1/objects/${object}/fields/${field.name}`;

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setProblem(null);
    try {
      await action();
      onChanged();
    } catch (error) {
      const first = error instanceof ApiError ? error.errors[0] : undefined;
      setProblem({
        field: first?.field,
        message: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      setSaving(false);
    }
  }

  const save = () => {
    const body = fieldPatchBody(field, edit);
    if (Object.keys(body).length === 0) return onClose();
    return run(() => api(url, { method: 'PATCH', json: body }));
  };
  const manyProblem =
    problem !== null &&
    (field.type === 'LINK' || field.type === 'USER' || field.type === 'FILE') &&
    problem.field !== 'label' &&
    /more than one|several members|several files/i.test(problem.message);
  const optionsProblem =
    problem &&
    (problem.field === 'config.options' ||
      (field.type === 'ENUM' && /choice/i.test(problem.message)));

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Edit {field.label}</DrawerTitle>
        <DrawerDescription>
          The key and type cannot be changed once a field exists.
        </DrawerDescription>
      </DrawerHeader>
      {problem && !optionsProblem && !manyProblem && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{problem.message}</AlertDescription>
        </Alert>
      )}
      <DrawerBody>
        <form
          id="edit-field-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="edit-field-label">Label *</FieldLabel>
              <Input
                id="edit-field-label"
                required
                maxLength={100}
                value={edit.label}
                onChange={(e) => change({ label: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-field-name">Key</FieldLabel>
              <Input id="edit-field-name" value={field.name} disabled readOnly />
              <FieldDescription>What the API and integrations call this field.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-field-type">Type</FieldLabel>
              <Input id="edit-field-type" value={FIELD_TYPE_LABELS[field.type]} disabled readOnly />
            </Field>
            {field.type === 'LINK' && (
              <Field>
                <FieldLabel htmlFor="edit-field-target">Links to</FieldLabel>
                <Input id="edit-field-target" value={field.config.target ?? ''} disabled readOnly />
              </Field>
            )}
            {(field.type === 'LINK' || field.type === 'USER' || field.type === 'FILE') && (
              <Field>
                <FieldLabel htmlFor="edit-field-many">Holds</FieldLabel>
                <NativeSelect
                  id="edit-field-many"
                  value={edit.many ? 'many' : 'one'}
                  onChange={(event) => change({ many: event.target.value === 'many' })}
                >
                  <option value="one">
                    {field.type === 'LINK' ? 'One record' : field.type === 'FILE' ? 'One file' : 'One member'}
                  </option>
                  <option value="many">
                    {field.type === 'LINK'
                      ? 'Many records'
                      : field.type === 'FILE'
                        ? 'Several files'
                        : 'Several members'}
                  </option>
                </NativeSelect>
                <FieldDescription>
                  Going from many to one is only possible when nobody holds more than one.
                </FieldDescription>
                {problem && manyProblem && (
                  <p role="alert" className="text-xs text-destructive">
                    {problem.message}
                  </p>
                )}
              </Field>
            )}
            {field.type === 'ENUM' && (
              <Field>
                <FieldLabel htmlFor="edit-field-options">Choices *</FieldLabel>
                <textarea
                  id="edit-field-options"
                  required
                  rows={6}
                  value={edit.options}
                  aria-invalid={optionsProblem ? true : undefined}
                  onChange={(e) => change({ options: e.target.value })}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
                />
                <FieldDescription>
                  One per line. A choice that records still use cannot be removed.
                </FieldDescription>
                {optionsProblem && (
                  <p role="alert" className="text-xs text-destructive">
                    {problem.message}
                  </p>
                )}
              </Field>
            )}
            {field.type !== 'FILE' && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={edit.filterable}
                onChange={(e) => change({ filterable: e.target.checked })}
                className="size-4 accent-primary"
              />
              Searchable and sortable
            </label>
            )}
            {field.type !== 'FILE' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={edit.required}
                  onChange={(e) => change({ required: e.target.checked })}
                  className="size-4 accent-primary"
                />
                Required
              </label>
              {hasRecords && !field.required && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Only possible when every record already has a value.
                </p>
              )}
            </div>
            )}
          </FieldGroup>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div className="mr-auto flex gap-2">
          {confirmingRemove ? (
            <>
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => run(() => api(url, { method: 'DELETE' }))}
              >
                Yes, remove
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setConfirmingRemove(false)}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => setConfirmingRemove(true)}
            >
              Remove field
            </Button>
          )}
        </div>
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="edit-field-form" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DrawerFooter>
      {confirmingRemove && (
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          The column goes away everywhere. The values stay stored and come back if you add a field
          with the same key and type.
        </p>
      )}
    </>
  );
}

/** One field's settings, opened from the cog in its column header. */
export function FieldSettingsDrawer({
  object,
  fields,
  editing,
  hasRecords,
  onClose,
  onChanged,
}: {
  object: string;
  fields: FieldDef[];
  /** The key of the field being edited, if one is. */
  editing: string | null;
  hasRecords: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const field = fields.find((f) => f.name === editing);
  return (
    <Drawer open={field !== undefined} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        {field && (
          <EditField
            key={field.name}
            object={object}
            field={field}
            hasRecords={hasRecords}
            onClose={onClose}
            onChanged={() => {
              onClose();
              onChanged();
            }}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
