'use client';

import type { DynamicToolUIPart, ToolUIPart } from 'ai';
import { Badge, Button, MessageResponse } from '@zuko/ui-kit';
import clsx from 'clsx';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const CircleIcon = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);
import type { ComponentProps, ReactNode } from 'react';
import { createContext, isValidElement, useContext, useState } from 'react';

export type ToolPart = ToolUIPart | DynamicToolUIPart;

const statusLabels: Record<ToolPart['state'], string> = {
  'approval-requested': 'Awaiting Approval',
  'approval-responded': 'Responded',
  'input-available': 'Running',
  'input-streaming': 'Pending',
  'output-available': 'Completed',
  'output-denied': 'Denied',
  'output-error': 'Error',
};

const statusColors: Record<
  ToolPart['state'],
  'zinc' | 'yellow' | 'blue' | 'green' | 'orange' | 'red'
> = {
  'approval-requested': 'yellow',
  'approval-responded': 'blue',
  'input-available': 'zinc',
  'input-streaming': 'zinc',
  'output-available': 'green',
  'output-denied': 'orange',
  'output-error': 'red',
};

const statusIcons: Record<ToolPart['state'], ReactNode> = {
  'approval-requested': <ClockIcon className="size-4 text-yellow-600" />,
  'approval-responded': <CheckCircleIcon className="size-4 text-blue-600" />,
  'input-available': <ClockIcon className="size-4 animate-pulse" />,
  'input-streaming': <CircleIcon className="size-4" />,
  'output-available': <CheckCircleIcon className="size-4 text-green-600" />,
  'output-denied': <XCircleIcon className="size-4 text-orange-600" />,
  'output-error': <XCircleIcon className="size-4 text-red-600" />,
};

const ToolContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => { /* default no-op until provider */ } });

export type ToolProps = ComponentProps<'div'> & {
  defaultOpen?: boolean;
};

export const Tool = ({
  className = '',
  defaultOpen = false,
  children,
  ...props
}: ToolProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ToolContext.Provider value={{ open, setOpen }}>
      <div
        data-slot="tool"
        data-state={open ? 'open' : 'closed'}
        className={clsx('group mb-4 w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900', className)}
        {...props}
      >
        {children}
      </div>
    </ToolContext.Provider>
  );
};

export const getStatusBadge = (status: ToolPart['state']) => (
  <Badge className="gap-1.5 rounded-full text-xs" color={statusColors[status]}>
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart['type']; state: ToolUIPart['state']; toolName?: never }
  | {
      type: DynamicToolUIPart['type'];
      state: DynamicToolUIPart['state'];
      toolName: string;
    }
) &
  Omit<ComponentProps<'button'>, 'title' | 'type' | 'color'>;

export const ToolHeader = ({
  className = '',
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const { open, setOpen } = useContext(ToolContext);
  const derivedName =
    type === 'dynamic-tool'
      ? (toolName ?? '')
      : String(type).split('-').slice(1).join('-');

  return (
    <Button
      plain
      onClick={() => setOpen(!open)}
      className={clsx('w-full justify-between gap-4 rounded-none rounded-t-md p-3 font-normal', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-zinc-500 dark:text-zinc-400" />
        <span className="text-sm font-medium">{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon
        className={clsx('size-4 text-zinc-500 transition-transform dark:text-zinc-400', open && 'rotate-180')}
      />
    </Button>
  );
};

export type ToolContentProps = ComponentProps<'div'>;

export const ToolContent = ({
  className = '',
  children,
  ...props
}: ToolContentProps) => {
  const { open } = useContext(ToolContext);
  if (!open) return null;
  return (
    <div
      className={clsx('space-y-4 border-t border-zinc-200 p-4 text-zinc-700 outline-none dark:border-zinc-700 dark:text-zinc-300', className)}
      {...props}
    >
      {children}
    </div>
  );
};

/** JSON code block */
function JsonCodeBlock({
  code,
  className = '',
}: {
  code: string;
  className?: string;
}) {
  const keyRe = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
  const strRe = /: "([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const numRe = /: (\d+\.?\d*)/g;
  const boolNullRe = /: (true|false|null)\b/g;
  let lastIndex = 0;

  const full = code;
  const matches: { index: number; end: number; repl: ReactNode }[] = [];

  let m: RegExpExecArray | null;
  keyRe.lastIndex = 0;
  while ((m = keyRe.exec(full)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      repl: (
        <span key={`k-${m.index}`} className="text-blue-600 dark:text-blue-400">
          {m[0]}
        </span>
      ),
    });
  }
  strRe.lastIndex = 0;
  while ((m = strRe.exec(full)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      repl: (
        <span key={`s-${m.index}`} className="text-emerald-700 dark:text-emerald-400">
          {m[0]}
        </span>
      ),
    });
  }
  numRe.lastIndex = 0;
  while ((m = numRe.exec(full)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      repl: (
        <span key={`n-${m.index}`} className="text-amber-700 dark:text-amber-400">
          {m[0]}
        </span>
      ),
    });
  }
  boolNullRe.lastIndex = 0;
  while ((m = boolNullRe.exec(full)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      repl: (
        <span key={`b-${m.index}`} className="text-zinc-500 dark:text-zinc-400">
          {m[0]}
        </span>
      ),
    });
  }

  matches.sort((a, b) => a.index - b.index);
  const merged: { start: number; end: number; node: ReactNode }[] = [];
  for (const mt of matches) {
    const overlap = merged.find((x) => mt.index < x.end && mt.end > x.start);
    if (!overlap) merged.push({ start: mt.index, end: mt.end, node: mt.repl });
  }
  merged.sort((a, b) => a.start - b.start);

  const segments: ReactNode[] = [];
  lastIndex = 0;
  for (const { start, end, node } of merged) {
    if (start > lastIndex) segments.push(full.slice(lastIndex, start));
    segments.push(node);
    lastIndex = end;
  }
  if (lastIndex < full.length) segments.push(full.slice(lastIndex));

  return (
    <pre
      className={clsx('overflow-x-auto rounded-md border border-zinc-200/80 bg-zinc-50/80 p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200', className)}
    >
      <code className="block min-w-0 whitespace-pre">{segments}</code>
    </pre>
  );
}

export type ToolInputProps = ComponentProps<'div'> & {
  input: ToolPart['input'];
};

export const ToolInput = ({
  className = '',
  input,
  ...props
}: ToolInputProps) => (
  <div className={clsx('space-y-2 overflow-hidden', className)} {...props}>
    <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      Parameters
    </h4>
    <div className="[&_table]:w-full">
      <JsonCodeBlock code={JSON.stringify(input, null, 2)} />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ToolPart['output'];
  errorText: ToolPart['errorText'];
};

export const ToolOutput = ({
  className = '',
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output: ReactNode = <div>{output as ReactNode}</div>;

  if (typeof output === 'object' && !isValidElement(output) && !Array.isArray(output)) {
    Output = <JsonCodeBlock code={JSON.stringify(output, null, 2)} />;
  } else if (typeof output === 'object' && !isValidElement(output) && Array.isArray(output)) {
    Output = <JsonCodeBlock code={JSON.stringify(output, null, 2)} />;
  } else if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);
      if (typeof parsed === 'object' && parsed !== null) {
        Output = <JsonCodeBlock code={JSON.stringify(parsed, null, 2)} />;
      } else {
        Output = (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MessageResponse>{output}</MessageResponse>
          </div>
        );
      }
    } catch {
      Output = (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MessageResponse>{output}</MessageResponse>
        </div>
      );
    }
  }

  return (
    <div className={clsx('space-y-2', className)} {...props}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={
          errorText
            ? 'overflow-x-auto rounded-md border border-red-200 bg-red-500/10 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400'
            : 'overflow-x-auto rounded-md [&_table]:w-full'
        }
      >
        {errorText ? <div className="font-medium">{errorText}</div> : Output}
      </div>
    </div>
  );
};
