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
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <Icon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div>
        <Heading
          level={1}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onTitleBlur(e.currentTarget.innerText)}
          className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1 transition-all"
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
