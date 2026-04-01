'use client';

import React, { forwardRef, useState, useEffect } from 'react';
import { Input } from './input';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export interface DateInputProps extends Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'type' | 'value' | 'onChange'
> {
  value?: string;
  onChange?: (value: string) => void;
  format?: string;
  invalid?: boolean;
  type?: 'date' | 'text';
}

/**
 * DateInput component that provides a better UX for date entry
 * - Displays dates in a readable format (DD/MM/YYYY by default)
 * - Accepts various input formats
 * - Stores values as YYYY-MM-DD (ISO format)
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput(
    {
      value = '',
      onChange,
      format = 'DD/MM/YYYY',
      placeholder,
      invalid,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    // Display value (formatted for user)
    const [displayValue, setDisplayValue] = useState('');

    // Initialize display value from ISO value
    useEffect(() => {
      if (value) {
        // Allow flexible parsing of existing values (handles both YYYY-MM-DD and full ISO strings)
        const parsed = dayjs(value);
        if (parsed.isValid()) {
          setDisplayValue(parsed.format(format));
        } else {
          setDisplayValue('');
        }
      } else {
        setDisplayValue('');
      }
    }, [value, format]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      setDisplayValue(input);

      // Try to parse the input in various formats
      const formats = [
        format, // User's preferred format (DD/MM/YYYY)
        'DD/MM/YYYY',
        'DD-MM-YYYY',
        'DD.MM.YYYY',
        'D/M/YYYY',
        'D/M/YY',
        'DD/MM/YY',
        'YYYY-MM-DD', // ISO format
      ];

      let parsed: dayjs.Dayjs | null = null;
      for (const fmt of formats) {
        const attempt = dayjs(input, fmt, true);
        if (attempt.isValid()) {
          parsed = attempt;
          break;
        }
      }

      // If valid, convert to ISO format (YYYY-MM-DD) and notify parent
      if (parsed && parsed.isValid()) {
        onChange?.(parsed.format('YYYY-MM-DD'));
      } else if (input === '') {
        // Clear the value
        onChange?.('');
      }
      // If invalid, just keep the display value as-is (don't update parent)
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, reformat the display value if it's valid
      if (value) {
        const parsed = dayjs(value);
        if (parsed.isValid()) {
          setDisplayValue(parsed.format(format));
        }
      } else if (displayValue) {
        // Try one more time to parse on blur
        const formats = [
          format,
          'DD/MM/YYYY',
          'DD-MM-YYYY',
          'D/M/YYYY',
          'D/M/YY',
          'YYYY-MM-DD',
        ];

        let parsed: dayjs.Dayjs | null = null;
        for (const fmt of formats) {
          const attempt = dayjs(displayValue, fmt, true);
          if (attempt.isValid()) {
            parsed = attempt;
            break;
          }
        }

        if (parsed && parsed.isValid()) {
          setDisplayValue(parsed.format(format));
          onChange?.(parsed.format('YYYY-MM-DD'));
        } else {
          // Invalid input - clear it
          setDisplayValue('');
        }
      }
    };

    return (
      <Input
        ref={ref}
        type={type || 'text'}
        value={type === 'date' ? (value ? dayjs(value).format('YYYY-MM-DD') : '') : displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder || format.toLowerCase()}
        invalid={invalid}
        disabled={disabled}
        {...props}
      />
    );
  },
);
