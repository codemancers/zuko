'use client';

import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import type React from 'react';
import { Text } from './text';

type SheetSide = 'left' | 'right' | 'top' | 'bottom';

const panelClasses: Record<SheetSide, string> = {
  right:
    'inset-y-0 right-0 h-full w-3/4 sm:max-w-sm ' +
    'data-closed:translate-x-full data-enter:ease-out data-leave:ease-in',
  left:
    'inset-y-0 left-0 h-full w-3/4 sm:max-w-sm ' +
    'data-closed:-translate-x-full data-enter:ease-out data-leave:ease-in',
  top:
    'inset-x-0 top-0 w-full h-auto max-h-[80vh] ' +
    'data-closed:-translate-y-full data-enter:ease-out data-leave:ease-in',
  bottom:
    'inset-x-0 bottom-0 w-full h-auto max-h-[80vh] rounded-t-3xl ' +
    'data-closed:translate-y-full data-enter:ease-out data-leave:ease-in',
};

export function Sheet({
  side = 'right',
  className,
  children,
  ...props
}: {
  side?: SheetSide;
  className?: string;
  children: React.ReactNode;
} & Omit<Headless.DialogProps, 'as' | 'className'>) {
  return (
    <Headless.Dialog {...props}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/25 transition duration-500 ease-out focus:outline-0 data-closed:opacity-0 data-leave:ease-in dark:bg-zinc-950/50"
      />

      <div className="fixed inset-0 overflow-hidden">
        <Headless.DialogPanel
          transition
          className={clsx(
            className,
            'absolute flex flex-col bg-white shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline',
            'transition duration-500 ease-out will-change-transform',
            panelClasses[side],
          )}
        >
          {children}
        </Headless.DialogPanel>
      </div>
    </Headless.Dialog>
  );
}

export function SheetTitle({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DialogTitleProps,
  'as' | 'className'
>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(
        className,
        'text-lg/6 font-semibold text-balance text-zinc-950 sm:text-base/6 dark:text-white',
      )}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DescriptionProps<typeof Text>,
  'as' | 'className'
>) {
  return (
    <Headless.Description
      as={Text}
      {...props}
      className={clsx(className, 'mt-2 text-pretty')}
    />
  );
}

export function SheetHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex shrink-0 items-center justify-between p-6 border-b border-zinc-950/10 dark:border-white/10',
      )}
    />
  );
}

export function SheetBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx('flex flex-1 flex-col overflow-y-auto p-6', className)}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex shrink-0 flex-col-reverse items-center justify-end gap-3 border-t border-zinc-950/10 p-6 sm:flex-row dark:border-white/10',
      )}
    />
  );
}
