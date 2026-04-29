'use client';

import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/ui/tooltip';
import { Badge } from './badge';

export interface MultiSelectOption {
  label: string;
  value: string;
}

/** Calls onClose once when the Listbox transitions from open → closed */
function CloseTracker({
  open,
  onClose,
}: {
  open: boolean;
  onClose?: () => void;
}) {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) {
      onClose?.();
    }
    wasOpen.current = open;
  });

  return null;
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  onClose,
  colorMap,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  className?: string;
  onClose?: () => void;
  colorMap?: Record<string, string>;
}) {
  const getColor = (val: string) => colorMap?.[val] ?? 'zinc';

  const selectedLabels = value
    .map((v) => ({
      label: options.find((o) => o.value === v)?.label ?? v,
      value: v,
    }))
    .filter(Boolean);

  return (
    <Headless.Listbox value={value} onChange={onChange} multiple>
      {({ open }: { open: boolean }) => (
        <>
          <CloseTracker open={open} onClose={onClose} />

          <span
            data-slot="control"
            className={clsx([
              className,
              'relative block w-full',
              'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
              'dark:before:hidden',
              'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
            ])}
          >
            <Headless.ListboxButton
              className={clsx([
                'relative flex min-h-[calc(--spacing(9)+2px)] w-full cursor-default flex-nowrap items-center gap-1 overflow-hidden rounded-lg py-1 pl-[calc(--spacing(3.5)-1px)] pr-[calc(--spacing(10)-1px)] sm:min-h-[calc(--spacing(7)+2px)] sm:pl-[calc(--spacing(3)-1px)] sm:pr-[calc(--spacing(9)-1px)]',
                'text-base/6 sm:text-sm/6',
                'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
                'bg-transparent dark:bg-white/5',
                'focus:outline-hidden',
              ])}
            >
              {selectedLabels.length === 0 ? (
                <span className="text-zinc-500">{placeholder}</span>
              ) : (
                <>
                  {selectedLabels.slice(0, 2).map((item) => (
                    <Badge
                      key={item.value}
                      color={getColor(item.value) as any}
                      className="max-w-[100px] truncate text-xs"
                    >
                      {item.label}
                    </Badge>
                  ))}
                  {selectedLabels.length > 2 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          color="zinc"
                          className="shrink-0 text-xs cursor-default"
                        >
                          +{selectedLabels.length - 2}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="flex flex-col gap-1">
                          {selectedLabels.slice(2).map((item) => (
                            <div key={item.value}>{item.label}</div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <svg
                  className="size-5 stroke-zinc-500 sm:size-4 dark:stroke-zinc-400"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  fill="none"
                >
                  <path
                    d="M5.75 10.75L8 13L10.25 10.75"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10.25 5.25L8 3L5.75 5.25"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Headless.ListboxButton>
          </span>

          <Headless.ListboxOptions
            transition
            anchor="bottom"
            className={clsx(
              '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(4)]',
              'isolate min-w-[calc(var(--button-width))] scroll-py-1 rounded-xl p-1 select-none empty:invisible',
              'outline outline-transparent',
              'overflow-y-auto overscroll-contain max-h-48',
              'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
              'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
              'transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none',
              'z-50',
            )}
          >
            {options.map((option) => (
              <Headless.ListboxOption
                key={option.value}
                value={option.value}
                className={clsx(
                  'group/option grid w-full cursor-default grid-cols-[1fr_--spacing(5)] items-center gap-x-2 rounded-lg py-2.5 pr-2 pl-3.5 sm:grid-cols-[1fr_--spacing(4)] sm:py-1.5 sm:pr-2 sm:pl-3',
                  'text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white',
                  'outline-hidden data-focus:bg-blue-500 data-focus:text-white',
                  'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]',
                )}
              >
                <span className="flex min-w-0 items-center truncate">
                  {option.label}
                </span>
                <svg
                  className="relative col-start-2 hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 8.5l3 3L12 4"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Headless.ListboxOption>
            ))}
          </Headless.ListboxOptions>
        </>
      )}
    </Headless.Listbox>
  );
}
