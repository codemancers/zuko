'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Command, defaultFilter } from 'cmdk';
import { Dialog } from 'radix-ui';
import {
  ArrowUpRight,
  Boxes,
  Command as CommandIcon,
  House,
  LoaderCircle,
  PlugZap,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { objectListQuery, type ObjectSummary } from '@/lib/queries';
import {
  recordLabel,
  searchBody,
  searchableFields,
  type ObjectDef,
  type RecordsPage,
} from '@/lib/records';
import { getObjectIcon } from '@/components/records/object-icons';
import { cn } from '@/lib/utils';

type CommandObject = Pick<ObjectSummary, 'name' | 'label' | 'plural_label'>;
const STANDARD_OBJECTS: CommandObject[] = [
  { name: 'contact', label: 'Contact', plural_label: 'Contacts' },
  { name: 'company', label: 'Company', plural_label: 'Companies' },
  { name: 'deal', label: 'Deal', plural_label: 'Deals' },
];
const OpenCommandMenu = createContext<(() => void) | null>(null);
const itemClass =
  'flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50';
const groupClass =
  'p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground';

// Weak fuzzy command matches should not compete with a person's name or email.
function commandScore(value: string, query: string, keywords?: string[]) {
  const score = defaultFilter(value, query, keywords);
  return score >= 0.2 ? score : 0;
}

export function CommandMenuTrigger({
  collapsed = false,
  iconOnly = false,
}: {
  collapsed?: boolean;
  iconOnly?: boolean;
}) {
  const open = useContext(OpenCommandMenu);
  if (!open) return null;
  return (
    <Button
      variant="ghost"
      size={collapsed || iconOnly ? 'icon' : 'default'}
      aria-label="Open command menu"
      aria-keyshortcuts="Meta+K Control+K"
      title="Open command menu (⌘K / Ctrl+K)"
      onClick={open}
      className={cn(
        'text-muted-foreground',
        !collapsed && !iconOnly && 'h-9 w-full justify-start gap-2 px-2 text-sm',
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      {!collapsed && !iconOnly && (
        <>
          <span className="flex-1 text-left">Commands</span>
          <kbd className="rounded border px-1 text-[10px]">⌘K / Ctrl K</kbd>
        </>
      )}
    </Button>
  );
}

/** One command menu for the workspace, using cmdk for matching and keyboard selection. */
export function CommandMenu({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const changeOpen = useCallback((next: boolean) => {
    if (next) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setText('');
      setDebounced('');
    }
    setOpen(next);
  }, []);
  const openMenu = useCallback(() => changeOpen(true), [changeOpen]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        changeOpen(!open);
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [open, changeOpen]);
  const typed = text.trim();
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setDebounced(typed), 250);
    return () => clearTimeout(timer);
  }, [typed, open]);
  const objectsQuery = useQuery({ ...objectListQuery, enabled: open });
  const objects: CommandObject[] = [
    ...STANDARD_OBJECTS.map(
      (standard) =>
        objectsQuery.data?.results.find((object) => object.name === standard.name) ?? standard,
    ),
    ...(objectsQuery.data?.results.filter(
      (object) => !STANDARD_OBJECTS.some((standard) => standard.name === object.name),
    ) ?? []),
  ];
  const recordObjects = open && debounced.length >= 2 ? (objectsQuery.data?.results ?? []) : [];
  const definitions = useQueries({
    queries: recordObjects.map((object) => ({
      queryKey: ['command-definition', object.name],
      staleTime: 0,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<ObjectDef>(`/api/v1/objects/${object.name}`, { signal }),
    })),
  });
  const matches = useQueries({
    queries: recordObjects.map((object, index) => ({
      queryKey: ['command-records', object.name, debounced],
      staleTime: 0,
      gcTime: 0,
      enabled:
        !!definitions[index].data && searchableFields(definitions[index].data!.fields).length > 0,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<RecordsPage>(`/api/v1/objects/${object.name}/records/filter`, {
          method: 'POST',
          json: searchBody(definitions[index].data!.fields, debounced, 1, 5, null),
          signal,
        }),
    })),
  });
  const current = open && typed === debounced && typed.length >= 2;
  const searching =
    open &&
    typed.length >= 2 &&
    (typed !== debounced ||
      objectsQuery.isFetching ||
      definitions.some((query) => query.isFetching) ||
      matches.some((query) => query.isFetching));
  const hasErrors =
    objectsQuery.isError ||
    definitions.some((query) => query.isError) ||
    matches.some((query) => query.isError);
  function navigate(href: string) {
    changeOpen(false);
    router.push(href);
  }
  const destinations = [
    { label: 'Home', href: '/dashboard', keywords: ['dashboard'], icon: House },
    ...objects.map((object) => ({
      label: object.plural_label,
      href: `/records/${object.name}`,
      keywords: [object.label, object.name],
      icon: getObjectIcon(object.name),
    })),
    { label: 'Profile', href: '/account/profile', keywords: ['account'], icon: UserRound },
    {
      label: 'Connected apps',
      href: '/account/connections',
      keywords: ['integrations', 'MCP', 'connections'],
      icon: PlugZap,
    },
    {
      label: 'Organization settings',
      href: '/org/settings/details',
      keywords: ['organization', 'workspace', 'details'],
      icon: Settings,
    },
    {
      label: 'Members',
      href: '/org/settings/members',
      keywords: ['team', 'users', 'invite', 'invitations'],
      icon: Users,
    },
    {
      label: 'Objects',
      href: '/org/settings/objects',
      keywords: ['schema', 'record types', 'custom objects'],
      icon: Boxes,
    },
    {
      label: 'Access settings',
      href: '/org/settings/access',
      keywords: ['permissions', 'roles', 'access control'],
      icon: ShieldCheck,
    },
  ];
  return (
    <OpenCommandMenu.Provider value={openMenu}>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        {children}
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" />
          <Dialog.Content
            className="fixed top-[min(15vh,7rem)] left-1/2 z-[60] flex max-h-[75svh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (previousFocus.current?.isConnected) previousFocus.current.focus();
            }}
          >
            <Dialog.Title className="sr-only">Command menu</Dialog.Title>
            <Dialog.Description className="sr-only">
              Navigate, create records, or find records in this organization. Use the arrow keys to
              select and Enter to open.
            </Dialog.Description>
            <Command
              label="Search commands and records"
              loop
              vimBindings={false}
              filter={(value, query, keywords) =>
                value.startsWith('record:') ? 1 : commandScore(value, query, keywords)
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex shrink-0 items-center gap-3 border-b px-4">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <Command.Input
                  value={text}
                  onValueChange={setText}
                  placeholder="Where would you like to go?"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close command menu">
                    <X aria-hidden />
                  </Button>
                </Dialog.Close>
              </div>
              <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {!searching && !hasErrors && (
                  <Command.Empty className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No matching commands or records.
                  </Command.Empty>
                )}
                <Command.Group heading="Go to" className={groupClass}>
                  {destinations.map((destination) => (
                    <Command.Item
                      key={destination.href}
                      value={`Go to ${destination.label}`}
                      keywords={destination.keywords}
                      onSelect={() => navigate(destination.href)}
                      className={itemClass}
                    >
                      <destination.icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      {destination.label}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Create" className={groupClass}>
                  <Command.Item
                    value="Create organization"
                    keywords={['new workspace', 'new organization']}
                    onSelect={() => navigate('/organizations/new')}
                    className={itemClass}
                  >
                    <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    Create organization
                  </Command.Item>
                  {objects.map((object) => {
                    const Icon = getObjectIcon(object.name);
                    return (
                      <Command.Item
                        key={object.name}
                        value={`Create ${object.label}`}
                        keywords={['add', 'new', object.plural_label]}
                        onSelect={() => navigate(`/records/${object.name}?new=1`)}
                        className={itemClass}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        Create {object.label.toLowerCase()}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
                {searching && (
                  <output className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                    <LoaderCircle
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                    Finding records…
                  </output>
                )}
                {objectsQuery.isError && (
                  <div role="alert" className="px-5 py-3 text-sm text-destructive">
                    <p>{objectsQuery.error.message}</p>
                    <Button variant="ghost" size="sm" onClick={() => void objectsQuery.refetch()}>
                      Retry loading objects
                    </Button>
                  </div>
                )}
                {current &&
                  recordObjects.map((object, index) => {
                    const definition = definitions[index];
                    const result = matches[index];
                    const error = definition.error ?? result.error;
                    const Icon = getObjectIcon(object.name);
                    return (
                      <Command.Group
                        key={object.name}
                        heading={object.plural_label}
                        forceMount={!!error}
                        className={groupClass}
                      >
                        {error && (
                          <div role="alert" className="px-3 py-2 text-sm text-destructive">
                            <p>
                              {object.plural_label}: {error.message}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void (definition.isError ? definition.refetch() : result.refetch())
                              }
                            >
                              Retry {object.plural_label.toLowerCase()}
                            </Button>
                          </div>
                        )}
                        {definition.data &&
                          result.data?.results.map((record) => (
                            <Command.Item
                              key={record.id}
                              value={`record:${object.name}:${record.id}`}
                              onSelect={() =>
                                navigate(
                                  `/records/${object.name}?open=${encodeURIComponent(record.id)}`,
                                )
                              }
                              className={itemClass}
                            >
                              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="truncate">
                                {recordLabel(definition.data!, record)}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {object.label}
                              </span>
                            </Command.Item>
                          ))}
                        {result.data && result.data.metadata.has_next && (
                          <Command.Item
                            value={`Show all ${object.plural_label} matching ${typed}`}
                            keywords={[typed]}
                            onSelect={() =>
                              navigate(`/records/${object.name}?q=${encodeURIComponent(typed)}`)
                            }
                            className={itemClass}
                          >
                            View all matching {object.plural_label.toLowerCase()}
                            <ArrowUpRight className="ml-auto size-4" aria-hidden />
                          </Command.Item>
                        )}
                      </Command.Group>
                    );
                  })}
              </Command.List>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
                <span>↑ ↓ to navigate · ↵ to open · Esc to close</span>
                <CommandIcon className="size-3.5" aria-hidden />
              </div>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </OpenCommandMenu.Provider>
  );
}
