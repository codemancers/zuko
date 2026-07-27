'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { icpApi, type IcpFilters } from '@/lib/api/icp';
import { ArrowUpIcon, SparklesIcon } from '@heroicons/react/20/solid';

// ---------- Types ----------

type Role = 'ai' | 'user';
type Stage =
  | 'greeting'
  | 'awaiting_description'
  | 'compiling'
  | 'awaiting_confirm'
  | 'awaiting_name'
  | 'creating'
  | 'done';

interface Message {
  id: string;
  role: Role;
  content: string;
  filters?: IcpFilters;
  contactsCount?: number | null;
  filterBreadth?: 'ok' | 'warn' | 'broad' | null;
}

// ---------- Filter pills ----------

function FilterPills({ filters }: { filters: IcpFilters }) {
  const pills: { label: string; value: string; color: string }[] = [];

  if (filters.organizationName)
    pills.push({
      label: 'Company',
      value: filters.organizationName,
      color: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/20',
    });
  filters.organizationDomains?.forEach((v) =>
    pills.push({
      label: 'Domain',
      value: v,
      color: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/20',
    }),
  );
  filters.industries?.forEach((v) =>
    pills.push({
      label: 'Industry',
      value: v,
      color: 'bg-violet-500/15 text-violet-300 ring-violet-500/20',
    }),
  );
  filters.employeeRanges?.forEach((v) =>
    pills.push({
      label: 'Employees',
      value: v,
      color: 'bg-sky-500/15 text-sky-300 ring-sky-500/20',
    }),
  );
  filters.locations?.forEach((v) =>
    pills.push({
      label: 'Location',
      value: v,
      color: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
    }),
  );
  filters.excludeLocations?.forEach((v) =>
    pills.push({
      label: 'Exclude',
      value: v,
      color: 'bg-red-500/15 text-red-300 ring-red-500/20',
    }),
  );
  filters.personTitles?.forEach((v) =>
    pills.push({
      label: 'Title',
      value: v,
      color: 'bg-amber-500/15 text-amber-300 ring-amber-500/20',
    }),
  );
  filters.personSeniorities?.forEach((v) =>
    pills.push({
      label: 'Seniority',
      value: v,
      color: 'bg-orange-500/15 text-orange-300 ring-orange-500/20',
    }),
  );
  filters.technologiesAnyOf?.forEach((v) =>
    pills.push({
      label: 'Tech',
      value: v,
      color: 'bg-pink-500/15 text-pink-300 ring-pink-500/20',
    }),
  );

  if (pills.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {pills.map((p, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset font-mono ${p.color}`}
        >
          <span className="opacity-50">{p.label}:</span> {p.value}
        </span>
      ))}
    </div>
  );
}

// ---------- Breadth badge ----------

function BreadthBadge({
  breadth,
  count,
}: {
  breadth: 'ok' | 'warn' | 'broad' | null;
  count: number | null;
}) {
  if (count === null) return null;

  const cfg = {
    ok: {
      label: 'Good fit',
      cls: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    },
    warn: {
      label: 'Broad',
      cls: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    },
    broad: {
      label: 'Very broad — consider narrowing',
      cls: 'text-red-400 bg-red-500/10 ring-red-500/20',
    },
  }[breadth ?? 'ok'];

  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ring-1 ring-inset ${cfg.cls}`}
    >
      <span className="font-mono font-semibold">
        {count.toLocaleString()} contacts
      </span>
      <span className="opacity-60">·</span>
      <span>{cfg.label}</span>
    </div>
  );
}

// ---------- Typing indicator ----------

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  );
}

// ---------- Main component ----------

export default function IcpChat({
  profile,
}: {
  profile?: { id: number; name: string; filters: IcpFilters };
}) {
  const isEditMode = !!profile;
  const router = useRouter();
  const queryClient = useQueryClient();

  const idRef = useRef(0);
  const nextId = () => String(++idRef.current);

  const initMessages = (): Message[] => {
    if (isEditMode) {
      return [
        {
          id: nextId(),
          role: 'ai',
          content: `Here are the current filters for **${profile.name}**. Say **yes** to keep them, or describe what to change.`,
          filters: profile.filters,
        },
      ];
    }
    return [
      {
        id: nextId(),
        role: 'ai',
        content:
          'Describe your ideal customer — industry, company size, location, job titles, technologies they use. The more specific, the better.',
      },
    ];
  };

  const [messages, setMessages] = useState<Message[]>(initMessages);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>(
    isEditMode ? 'awaiting_confirm' : 'awaiting_description',
  );
  const [isTyping, setIsTyping] = useState(false);
  const [compiledFilters, setCompiledFilters] = useState<IcpFilters | null>(
    isEditMode ? profile.filters : null,
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pushMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: String(++idRef.current) }]);
  }, []);

  const aiReply = useCallback(
    (content: string, extra?: Partial<Message>) => {
      setIsTyping(false);
      pushMessage({ role: 'ai', content, ...extra });
    },
    [pushMessage],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Compile description mutation
  const compileMutation = useMutation({
    mutationFn: async (description: string) => {
      const filters = await icpApi.compileDescription(description);
      const preview = await icpApi
        .previewFilters(profile?.id ?? 1, filters)
        .catch(() => null);
      return { filters, preview };
    },
    onSuccess: ({ filters, preview }) => {
      setCompiledFilters(filters);
      setStage('awaiting_confirm');
      aiReply(
        "Here's what I found. Does this look right? Say **yes** to continue, or describe what to change.",
        {
          filters,
          contactsCount: preview?.contactsCount ?? null,
          filterBreadth: preview?.filterBreadth ?? null,
        },
      );
    },
    onError: () => {
      setStage('awaiting_description');
      aiReply("Couldn't compile that. Try again with more detail.");
    },
  });

  // Refine: re-compile with additional context
  const refineMutation = useMutation({
    mutationFn: async (refinement: string) => {
      const filters = await icpApi.refineFilters(
        compiledFilters ?? {},
        refinement,
      );
      const preview = await icpApi
        .previewFilters(profile?.id ?? 1, filters)
        .catch(() => null);
      return { filters, preview };
    },
    onSuccess: ({ filters, preview }) => {
      setCompiledFilters(filters);
      setStage('awaiting_confirm');
      aiReply('Updated. Does this look right now?', {
        filters,
        contactsCount: preview?.contactsCount ?? null,
        filterBreadth: preview?.filterBreadth ?? null,
      });
    },
    onError: () => {
      setStage('awaiting_confirm');
      aiReply("Couldn't apply that change. Try rephrasing.");
    },
  });

  // Create mutation (new mode only)
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      icpApi.createProfile({ name, filters: compiledFilters ?? {} }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['icp', 'profiles'] });
      setStage('done');
      aiReply(`**${created.name}** created. Redirecting…`);
      setTimeout(() => router.push(`/icps/${created.id}`), 800);
    },
    onError: () => {
      setStage('awaiting_name');
      aiReply("Couldn't create the profile. Try a different name.");
    },
  });

  // Update mutation (edit mode only)
  const updateMutation = useMutation({
    mutationFn: () =>
      icpApi.updateProfile(profile!.id, { filters: compiledFilters ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['icp', 'profile', profile!.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['icp', 'companies', profile!.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['icp', 'contacts', profile!.id],
      });
      setStage('done');
      aiReply('Filters saved. Redirecting…');
      setTimeout(() => router.push(`/icps/${profile!.id}`), 800);
    },
    onError: () => {
      setStage('awaiting_confirm');
      aiReply("Couldn't save. Try again.");
    },
  });

  const isLoading =
    compileMutation.isPending ||
    refineMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    isTyping;

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    pushMessage({ role: 'user', content: text });
    setIsTyping(true);

    if (stage === 'awaiting_description') {
      setStage('compiling');
      compileMutation.mutate(text);
    } else if (stage === 'awaiting_confirm') {
      setStage('compiling');
      try {
        const intent = await icpApi.classifyIntent(text);
        if (intent === 'confirm') {
          if (isEditMode) {
            updateMutation.mutate();
          } else {
            setStage('awaiting_name');
            aiReply('What should we call this ICP profile?');
          }
        } else {
          refineMutation.mutate(text);
        }
      } catch {
        setStage('awaiting_confirm');
        aiReply("Couldn't understand that. Try again.");
      }
    } else if (stage === 'awaiting_name') {
      setStage('creating');
      createMutation.mutate(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const placeholder =
    stage === 'awaiting_description'
      ? 'e.g. SaaS companies 50-500 employees, VP Sales or CTO, using Salesforce, US only…'
      : stage === 'awaiting_confirm'
        ? 'Confirm or describe what to change…'
        : stage === 'awaiting_name'
          ? 'e.g. Mid-Market SaaS US'
          : '';

  const backHref = isEditMode ? `/icps/${profile.id}` : '/icps';
  const backLabel = isEditMode ? `← ${profile.name}` : '← ICP Profiles';
  const pageLabel = isEditMode ? 'Edit filters' : 'New profile';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <a
          href={backHref}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          {backLabel}
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm font-medium text-zinc-900 dark:text-white">
          {pageLabel}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {msg.role === 'ai' && (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700 dark:bg-zinc-800">
                  <SparklesIcon className="size-3.5 text-zinc-300" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-tr-sm'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-100 rounded-tl-sm'
                }`}
              >
                <MessageContent content={msg.content} />
                {msg.filters && <FilterPills filters={msg.filters} />}
                {msg.filters && (
                  <BreadthBadge
                    breadth={msg.filterBreadth ?? null}
                    count={msg.contactsCount ?? null}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700 dark:bg-zinc-800">
                <SparklesIcon className="size-3.5 text-zinc-300" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-3 dark:bg-zinc-800/60">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={
                isLoading ||
                stage === 'compiling' ||
                stage === 'creating' ||
                stage === 'done'
              }
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-white dark:placeholder-zinc-500 disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || stage === 'done'}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-all hover:bg-zinc-700 disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-600">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Markdown-lite renderer ----------

function MessageContent({ content }: { content: string }) {
  // Bold: **text**
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
