'use client';

import * as Headless from '@headlessui/react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { createContext, useContext, useId } from 'react';

// Shared layoutId context so all triggers in a list share the same
// Framer Motion layoutId, enabling the sliding indicator animation.
const TabsIndicatorContext = createContext<string>('tabs-indicator');

const tabsListVariants = cva(
  'group/tabs-list inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400',
  {
    variants: {
      variant: {
        default: 'rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800',
        line: 'gap-4 border-b border-zinc-950/5 dark:border-white/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: {
  orientation?: 'horizontal' | 'vertical';
} & Headless.TabGroupProps) {
  return (
    <Headless.TabGroup
      vertical={orientation === 'vertical'}
      className={clsx(
        'flex gap-4',
        orientation === 'horizontal' ? 'flex-col' : 'flex-row',
        className,
      )}
      {...props}
    />
  );
}

export function TabsList({
  className,
  variant = 'default',
  ...props
}: Headless.TabListProps & VariantProps<typeof tabsListVariants>) {
  // Generate a single layoutId shared across all triggers in this list
  const listId = useId();
  return (
    <TabsIndicatorContext value={listId + '-indicator'}>
      <Headless.TabList
        data-variant={variant}
        className={clsx(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsIndicatorContext>
  );
}

export function TabsTrigger({
  className,
  children,
  value,
  ...props
}: { value?: string } & Headless.TabProps) {
  // Use the shared layoutId from the parent TabsList so the indicator
  // animates (slides) between tabs instead of fading in/out per tab.
  const indicatorId = useContext(TabsIndicatorContext);

  return (
    <Headless.Tab
      className={clsx(
        'relative flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium outline-none transition-all focus:outline-none focus:ring-0',
        // Default (segmented) styles
        'group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:data-selected:bg-white group-data-[variant=default]/tabs-list:data-selected:text-zinc-950 group-data-[variant=default]/tabs-list:data-selected:shadow-xs dark:group-data-[variant=default]/tabs-list:data-selected:bg-zinc-700 dark:group-data-[variant=default]/tabs-list:data-selected:text-white',
        // Line styles
        'group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:text-zinc-500 hover:group-data-[variant=line]/tabs-list:text-zinc-950 data-selected:group-data-[variant=line]/tabs-list:text-zinc-950 dark:group-data-[variant=line]/tabs-list:text-zinc-400 dark:hover:group-data-[variant=line]/tabs-list:text-white dark:data-selected:group-data-[variant=line]/tabs-list:text-white',
        className,
      )}
      {...props}
    >
      {({ selected }) => (
        <>
          {children}
          {selected && (
            <motion.span
              layoutId={indicatorId}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="absolute inset-x-0 -bottom-px h-px bg-zinc-950 group-data-[variant=default]/tabs-list:hidden dark:bg-white"
            />
          )}
        </>
      )}
    </Headless.Tab>
  );
}

export function TabsPanels({ className, ...props }: Headless.TabPanelsProps) {
  return <Headless.TabPanels className={clsx('mt-4', className)} {...props} />;
}

export function TabsContent({
  className,
  value,
  ...props
}: { value?: string } & Headless.TabPanelProps) {
  return (
    <Headless.TabPanel
      className={clsx('outline-hidden', className)}
      {...props}
    />
  );
}

export { tabsListVariants };
