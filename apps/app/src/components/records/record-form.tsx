'use client';

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { Option } from '@/components/records/pick-cell';
import { editableFields, type FieldDef, type FormValues } from '@/lib/records';

/** The inputs for an object's fields: one control per field, chosen by the field's type. */
export function RecordForm({
  id,
  fields,
  values,
  errors,
  onChange,
  members = [],
  onSubmit,
}: {
  id: string;
  fields: FieldDef[];
  values: FormValues;
  /** Problems the server reported, by field name. */
  errors: Record<string, string>;
  onChange: (name: string, value: string | boolean | string[]) => void;
  /** The organization's members, for user fields. */
  members?: Option[];
  onSubmit: () => void;
}) {
  return (
    <form
      id={id}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        {editableFields(fields).map((field) => {
          const inputId = `${id}-${field.name}`;
          const error = errors[field.name];
          const common = {
            id: inputId,
            name: field.name,
            required: field.required,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? `${inputId}-error` : undefined,
          } as const;
          const value = values[field.name];
          return (
            <Field key={field.name}>
              {field.type === 'BOOLEAN' ? (
                <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium">
                  <input
                    {...common}
                    type="checkbox"
                    checked={value === true}
                    onChange={(event) => onChange(field.name, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  <FieldLabel id={`${inputId}-label`} htmlFor={inputId}>
                    {field.label}
                    {field.required && <span aria-hidden> *</span>}
                  </FieldLabel>
                  {field.type === 'USER' && field.config.many ? (
                    <fieldset
                      aria-labelledby={`${inputId}-label`}
                      aria-describedby={common['aria-describedby']}
                      aria-invalid={common['aria-invalid']}
                      className="flex flex-col gap-1.5 border-0 p-0"
                    >
                      {members.map((member) => {
                        const chosen = Array.isArray(value) && value.includes(member.value);
                        return (
                          <label key={member.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={chosen}
                              onChange={(event) => {
                                const now = Array.isArray(value) ? value : [];
                                onChange(
                                  field.name,
                                  event.target.checked
                                    ? [...now, member.value]
                                    : now.filter((id) => id !== member.value),
                                );
                              }}
                              className="size-4 accent-primary"
                            />
                            {member.label}
                          </label>
                        );
                      })}
                    </fieldset>
                  ) : field.type === 'USER' ? (
                    <NativeSelect
                      {...common}
                      value={String(value ?? '')}
                      onChange={(event) => onChange(field.name, event.target.value)}
                    >
                      <option value="">{field.required ? 'Choose…' : 'None'}</option>
                      {members.map((member) => (
                        <option key={member.value} value={member.value}>
                          {member.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : field.type === 'ENUM' ? (
                    <NativeSelect
                      {...common}
                      value={String(value ?? '')}
                      onChange={(event) => onChange(field.name, event.target.value)}
                    >
                      <option value="">{field.required ? 'Choose…' : 'None'}</option>
                      {(field.config.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      {...common}
                      type={
                        { EMAIL: 'email', NUMBER: 'number', TIMESTAMP: 'date' }[
                          field.type as string
                        ] ?? 'text'
                      }
                      step={field.type === 'NUMBER' ? 'any' : undefined}
                      maxLength={field.max_length ?? undefined}
                      value={String(value ?? '')}
                      onChange={(event) => onChange(field.name, event.target.value)}
                    />
                  )}
                </>
              )}
              {error && (
                <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </Field>
          );
        })}
      </FieldGroup>
    </form>
  );
}
