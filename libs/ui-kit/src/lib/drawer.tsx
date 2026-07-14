import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import type React from 'react';
import { Text } from './text';

const drawerSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export function Drawer({
  size = 'lg',
  className,
  children,
  ...props
}: {
  size?: keyof typeof drawerSizes;
  className?: string;
  children: React.ReactNode;
} & Omit<Headless.DialogProps, 'as' | 'className'>) {
  return (
    <Headless.Dialog {...props}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/25 transition duration-300 ease-in-out data-closed:opacity-0 dark:bg-zinc-950/50"
      />

      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <Headless.DialogPanel
              transition
              className={clsx(
                className,
                drawerSizes[size],
                'pointer-events-auto w-screen transition duration-300 ease-in-out data-closed:translate-x-full',
                'flex h-full flex-col overflow-y-scroll bg-white shadow-xl dark:bg-zinc-900',
              )}
            >
              {children}
            </Headless.DialogPanel>
          </div>
        </div>
      </div>
    </Headless.Dialog>
  );
}

export function DrawerTitle({
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
        'text-lg/6 font-semibold text-zinc-950 dark:text-white',
      )}
    />
  );
}

export function DrawerDescription({
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

export function DrawerBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'relative mt-6 flex-1')} />;
}

export function DrawerHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'px-4 py-6 sm:px-6')} />;
}

export function DrawerActions({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex shrink-0 justify-end gap-3 px-4 py-4 sm:px-6',
      )}
    />
  );
}
