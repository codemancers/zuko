'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { objectListQuery } from '@/lib/queries';
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
  FIELD_TYPE_LABELS,
  keyFromLabel,
  newFieldBody,
  type FieldType,
  type NewField,
} from '@/lib/records';

const BLANK: NewField = {
  label: '',
  name: '',
  type: 'TEXT',
  required: false,
  unique: false,
  filterable: true,
  options: '',
  target: '',
  many: false,
};
const TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

/** The drawer for adding a field to an object. The new field appears as a column straight away. */
export function AddFieldDrawer({
  object,
  label,
  open,
  hasRecords,
  onClose,
  onAdded,
}: {
  /** The object's name in the API. */
  object: string;
  /** What one record is called, lowercase, for the wording. */
  label: string;
  open: boolean;
  /** A required field cannot be added once there are records to fill it in for. */
  hasRecords: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [field, setField] = useState<NewField>(BLANK);
  const [keyEdited, setKeyEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // The other objects a link could point at, fetched the first time a link is chosen.
  const targetsQuery = useQuery({ ...objectListQuery, enabled: open && field.type === 'LINK' });
  const objects = targetsQuery.data?.results ?? (targetsQuery.isError ? [] : null);

  // Every opening starts from a blank form.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setField(BLANK);
      setKeyEdited(false);
      setErrors({});
      setFormError(null);
    }
  }

  const link = field.type === 'LINK';
  const user = field.type === 'USER';
  const file = field.type === 'FILE';
  const change = (changes: Partial<NewField>) =>
    setField((current) => ({ ...current, ...changes }));

  async function submit() {
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await api(`/api/v1/objects/${object}/fields`, { method: 'POST', json: newFieldBody(field) });
      onAdded();
    } catch (error) {
      if (error instanceof ApiError && error.errors.length > 0) {
        // The server names a field's options `config.options`; the form calls that box `options`.
        const byInput = Object.fromEntries(
          error.errors.map((e) => [e.field === 'config.options' ? 'options' : e.field, e.message]),
        );
        const shown = new Set(['label', 'name', 'type', 'options', 'config.target']);
        setErrors(byInput);
        setFormError(Object.keys(byInput).every((key) => shown.has(key)) ? null : error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'Something went wrong');
      }
    } finally {
      setSaving(false);
    }
  }

  const error = (name: string) =>
    errors[name] && (
      <p role="alert" className="text-xs text-destructive">
        {errors[name]}
      </p>
    );

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && !saving && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add field</DrawerTitle>
          <DrawerDescription>
            A new column for every {label}. The key and type cannot be changed afterwards.
          </DrawerDescription>
        </DrawerHeader>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <DrawerBody>
          <form
            id="add-field-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="add-field-label">Label *</FieldLabel>
                <Input
                  id="add-field-label"
                  required
                  maxLength={100}
                  value={field.label}
                  aria-invalid={errors.label ? true : undefined}
                  onChange={(event) =>
                    change({
                      label: event.target.value,
                      ...(keyEdited ? {} : { name: keyFromLabel(event.target.value) }),
                    })
                  }
                />
                {error('label')}
              </Field>
              <Field>
                <FieldLabel htmlFor="add-field-name">Key *</FieldLabel>
                <Input
                  id="add-field-name"
                  required
                  value={field.name}
                  aria-invalid={errors.name ? true : undefined}
                  onChange={(event) => {
                    setKeyEdited(true);
                    change({ name: event.target.value });
                  }}
                />
                <FieldDescription>
                  Lowercase letters, digits and underscores. What the API and integrations call this
                  field.
                </FieldDescription>
                {error('name')}
              </Field>
              <Field>
                <FieldLabel htmlFor="add-field-type">Type</FieldLabel>
                <NativeSelect
                  id="add-field-type"
                  value={field.type}
                  onChange={(event) => change({ type: event.target.value as FieldType })}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
                {error('type')}
              </Field>
              {link && (
                <Field>
                  <FieldLabel htmlFor="add-field-target">Links to *</FieldLabel>
                  <NativeSelect
                    id="add-field-target"
                    required
                    value={field.target}
                    aria-invalid={errors['config.target'] ? true : undefined}
                    onChange={(event) => change({ target: event.target.value })}
                  >
                    <option value="">{objects === null ? 'Loading…' : 'Choose an object…'}</option>
                    {(objects ?? [])
                      .filter((o) => o.name !== object)
                      .map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.plural_label}
                        </option>
                      ))}
                  </NativeSelect>
                  {targetsQuery.isError && (
                    <div role="alert" className="space-y-1 text-xs text-destructive">
                      <p>{targetsQuery.error.message}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void targetsQuery.refetch()}
                      >
                        Retry loading objects
                      </Button>
                    </div>
                  )}
                  {errors['config.target'] && (
                    <p role="alert" className="text-xs text-destructive">
                      {errors['config.target']}
                    </p>
                  )}
                </Field>
              )}
              {(link || user || file) && (
                <Field>
                  <FieldLabel htmlFor="add-field-many">Holds</FieldLabel>
                  <NativeSelect
                    id="add-field-many"
                    value={field.many ? 'many' : 'one'}
                    onChange={(event) => change({ many: event.target.value === 'many' })}
                  >
                    <option value="one">{link ? 'One record' : file ? 'One file' : 'One member'}</option>
                    <option value="many">
                      {link ? 'Many records' : file ? 'Several files' : 'Several members'}
                    </option>
                  </NativeSelect>
                  <FieldDescription>
                    {link
                      ? 'One, such as a primary contact; or many, such as all the contacts. The other object always sees many.'
                      : file
                        ? 'One, such as a signed contract; or several, such as all the photos. Up to 25 MB each.'
                        : 'One, such as an account manager; or several, such as everyone on the deal.'}
                  </FieldDescription>
                </Field>
              )}
              {field.type === 'ENUM' && (
                <Field>
                  <FieldLabel htmlFor="add-field-options">Choices *</FieldLabel>
                  <textarea
                    id="add-field-options"
                    required
                    rows={5}
                    value={field.options}
                    aria-invalid={errors.options ? true : undefined}
                    onChange={(event) => change({ options: event.target.value })}
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
                  />
                  <FieldDescription>One per line.</FieldDescription>
                  {error('options')}
                </Field>
              )}
              {!link && !file && !(user && field.many) && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={field.filterable}
                    onChange={(e) => change({ filterable: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  Searchable and sortable
                </label>
              )}
              {!link && !user && !file && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={field.unique}
                    onChange={(e) => change({ unique: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  Each value can be used once
                </label>
              )}
              {!link && !file && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={hasRecords}
                      onChange={(e) => change({ required: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    Required
                  </label>
                  {hasRecords && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Not available while there are {label} records to fill in.
                    </p>
                  )}
                </div>
              )}
            </FieldGroup>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-field-form" disabled={saving}>
            {saving ? 'Adding…' : 'Add field'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
