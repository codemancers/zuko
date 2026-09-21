import { Heading, Text } from '@zuko/ui-kit';
import type { ReactNode, ComponentType } from 'react';
import dayjs from 'dayjs';

interface DetailHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  onTitleBlur: (value: string) => void;
  isSaving?: boolean;
  createdAt?: string | Date;
  subtitle?: ReactNode;
}

export function DetailHeader({
  icon: Icon,
  title,
  onTitleBlur,
  isSaving,
  createdAt,
  subtitle,
}: DetailHeaderProps) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <Icon className="size-6 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div className="min-w-0">
        <Heading
          level={1}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onTitleBlur(e.currentTarget.innerText)}
          className="-mx-1 rounded px-1 text-2xl/8 font-semibold tracking-tight text-zinc-950 outline-none transition-[box-shadow] duration-150 ease-out focus:ring-2 focus:ring-blue-500 dark:text-white"
        >
          {title}
        </Heading>
        <div className="flex items-center gap-2 mt-1">
          {createdAt && (
            <Text>Created {dayjs(createdAt).format('MMMM D, YYYY')}</Text>
          )}
          {subtitle}
          {isSaving && (
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 animate-pulse">
              Syncing...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
