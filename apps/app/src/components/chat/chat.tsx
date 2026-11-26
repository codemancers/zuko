'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { activeTurn, activity } from 'eve/events';
import { useEveAgent, type EveInteractionPart, type EveMessagePart } from 'eve/react';
import { Bot, CircleStop, LoaderCircle, Send, Sparkles, UserRound, Wrench } from 'lucide-react';
import { Shell } from '@/components/dashboard/shell';
import { AttachButton } from '@/components/files/attach-button';
import { FileChip } from '@/components/files/file-chip';
import { MAX_MESSAGE_FILES, messageContent, zukoFileId } from '@/components/chat/chat-files';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';
import { useOrganizationSetup } from '@/lib/organization-setup';
import { getEveAccessToken } from '@/lib/eve-auth';
import { readChatHistory, saveChatHistory } from '@/lib/eve-history';
import type { AttachedFile } from '@/lib/files';
import { cn } from '@/lib/utils';

function InteractionCard({
  interaction,
  disabled,
  respond,
}: {
  interaction: EveInteractionPart;
  disabled: boolean;
  respond: (answer: { interactionId: string; optionId?: string; text?: string }) => void;
}) {
  const [answer, setAnswer] = useState('');
  const request = interaction.request;
  const signIn = request.signIn;
  if (interaction.status === 'settled') {
    return (
      <p className="text-xs text-muted-foreground">
        {request.title ?? (request.kind === 'approval' ? 'Approval' : 'Request')}:{' '}
        {interaction.outcome}
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div>
        <p className="text-sm font-medium">
          {request.title ??
            (request.kind === 'approval' ? 'Approval required' : 'Your input is needed')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{request.prompt}</p>
      </div>
      {signIn?.url && (
        <Button asChild size="sm">
          <a href={signIn.url}>Connect {signIn.displayName ?? signIn.name}</a>
        </Button>
      )}
      {request.options && request.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {request.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={
                option.style === 'danger'
                  ? 'destructive'
                  : option.style === 'primary'
                    ? 'default'
                    : 'outline'
              }
              disabled={disabled || interaction.answer !== undefined}
              title={option.description}
              onClick={() =>
                respond({ interactionId: interaction.interactionId, optionId: option.id })
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {request.allowFreeform && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = answer.trim();
            if (text) respond({ interactionId: interaction.interactionId, text });
          }}
        >
          <input
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={disabled}
            aria-label="Your answer"
            className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" disabled={disabled || !answer.trim()}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}

function MessagePart({
  part,
  disabled,
  respond,
}: {
  part: EveMessagePart;
  disabled: boolean;
  respond: (answer: { interactionId: string; optionId?: string; text?: string }) => void;
}) {
  if (part.type === 'text') return <p className="whitespace-pre-wrap leading-7">{part.text}</p>;
  if (part.type === 'reasoning') return null;
  if (part.type === 'file') {
    // A file stored in Zuko shows as a link to it; anything else is only named.
    const id = zukoFileId(part.url);
    if (id)
      return (
        <div className="my-1 inline-flex max-w-full rounded-md bg-background text-foreground">
          <FileChip
            file={{
              id,
              filename: part.filename ?? 'File',
              media_type: part.mediaType,
              size: part.size ?? 0,
            }}
          />
        </div>
      );
    return (
      <p className="text-sm text-muted-foreground">Attachment: {part.filename ?? part.mediaType}</p>
    );
  }
  if (part.type === 'interaction')
    return <InteractionCard interaction={part} disabled={disabled} respond={respond} />;
  return (
    <div className="my-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 font-medium text-muted-foreground">
        <Wrench className="size-3.5" aria-hidden />
        <span>{part.label}</span>
        <span className="ml-auto capitalize">{part.state}</span>
      </div>
      {part.interaction && (
        <InteractionCard
          interaction={{ ...part.interaction, type: 'interaction' }}
          disabled={disabled}
          respond={respond}
        />
      )}
    </div>
  );
}

function messagePartKey(part: EveMessagePart, index: number) {
  if (part.type === 'tool') return part.callId;
  if (part.type === 'interaction') return part.interactionId;
  if (part.type === 'file') return `${part.filename ?? part.mediaType}-${index}`;
  return part.id ?? index;
}

function ChatSession({
  sessionId,
  scope,
  organizationName,
}: {
  sessionId?: string;
  scope: string;
  organizationName: string;
}) {
  const pendingTitle = useRef(
    sessionId
      ? (readChatHistory(scope).find((item) => item.sessionId === sessionId)?.title ?? 'Chat')
      : 'New chat',
  );
  const bottom = useRef<HTMLDivElement>(null);
  const initialSession = useMemo(
    () => (sessionId ? { sessionId, streamIndex: 0 } : undefined),
    [sessionId],
  );
  const agent = useEveAgent({
    auth: { bearer: () => getEveAccessToken(scope) },
    initialSession,
    resume: initialSession !== undefined,
    onSessionChange: (next) => {
      if (!next) return;
      saveChatHistory(scope, {
        sessionId: next.sessionId,
        title: pendingTitle.current,
        updatedAt: new Date().toISOString(),
      });
      if (!sessionId) {
        History.prototype.replaceState.call(
          window.history,
          window.history.state,
          '',
          `/chat/s/${encodeURIComponent(next.sessionId)}`,
        );
      }
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [agent.messages, agent.status]);

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [sendError, setSendError] = useState<string>();
  const turn = activeTurn(agent.view);
  const currentActivity = activity(agent.view);
  const disabled = agent.status === 'resuming';
  const respond = (answer: { interactionId: string; optionId?: string; text?: string }) => {
    void agent.respond([answer]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b px-4 sm:px-6">
        <div>
          <h1 className="text-sm font-semibold">Zuko copilot</h1>
          <p className="text-xs text-muted-foreground">{organizationName}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href="/chat/new">New chat</Link>
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
          {agent.messages.length === 0 && agent.status !== 'resuming' ? (
            <div className="my-auto py-16 text-center">
              <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" aria-hidden />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">What can I help with?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Search your CRM, summarize relationships, or make changes with your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {agent.messages.map((message) => (
                <article
                  key={message.id}
                  className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                      message.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <Bot className="size-4" aria-hidden />
                    ) : (
                      <UserRound className="size-4" aria-hidden />
                    )}
                  </span>
                  <div
                    className={cn(
                      'min-w-0 max-w-[85%] text-sm',
                      message.role === 'user' &&
                        'rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground',
                    )}
                  >
                    {message.parts.map((part, index) => (
                      <MessagePart
                        key={messagePartKey(part, index)}
                        part={part}
                        disabled={disabled}
                        respond={respond}
                      />
                    ))}
                  </div>
                </article>
              ))}
              {(agent.status === 'busy' || agent.status === 'resuming') && (
                <output className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  {agent.status === 'resuming'
                    ? 'Loading conversation…'
                    : currentActivity.kind === 'calling'
                      ? currentActivity.names.join(', ')
                      : currentActivity.kind === 'waiting-on-interaction'
                        ? 'Waiting for your response'
                        : 'Thinking…'}
                </output>
              )}
            </div>
          )}
          {agent.error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {agent.error.message}
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="shrink-0 border-t bg-background p-3 sm:p-4">
        <form
          className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const text = String(new FormData(form).get('message') ?? '').trim();
            if ((!text && attachments.length === 0) || disabled) return;
            const files = attachments;
            pendingTitle.current = (text || files[0]?.filename || 'Files').slice(0, 72);
            setSendError(undefined);
            form.reset();
            setAttachments([]);
            // Cleared at once; put back, with the reason, if the message is refused.
            const restore = (reason: unknown) => {
              const box = form.elements.namedItem('message');
              if (box instanceof HTMLTextAreaElement) box.value = text;
              setAttachments(files);
              setSendError(reason instanceof Error ? reason.message : 'The message could not be sent');
            };
            agent.send(messageContent(text, files)).catch(restore);
          }}
        >
          {attachments.length > 0 && (
            <ul aria-label="Attached files" className="flex flex-wrap gap-1.5 px-1 pt-1">
              {attachments.map((file) => (
                <li key={file.id} className="min-w-0 max-w-full">
                  <FileChip
                    file={file}
                    disabled={disabled}
                    onRemove={() => setAttachments((all) => all.filter((f) => f.id !== file.id))}
                  />
                </li>
              ))}
            </ul>
          )}
          {sendError && (
            <p role="alert" className="px-2 text-xs text-destructive">
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
          <AttachButton
            disabled={disabled || attachments.length >= MAX_MESSAGE_FILES}
            onUploaded={(files) => {
              setSendError(undefined);
              const room = MAX_MESSAGE_FILES - attachments.length;
              setAttachments((all) => [...all, ...files].slice(0, MAX_MESSAGE_FILES));
              if (files.length > room)
                setSendError(`A message can carry at most ${MAX_MESSAGE_FILES} files`);
            }}
          />
          <textarea
            name="message"
            rows={1}
            aria-label="Message Zuko copilot"
            placeholder="Ask about your CRM…"
            disabled={disabled}
            className="max-h-40 min-h-9 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {turn ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Stop response"
              onClick={() => void agent.cancel()}
            >
              <CircleStop aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send message" disabled={disabled}>
              <Send aria-hidden />
            </Button>
          )}
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
          Changes require your approval. Zuko applies your normal permissions.
        </p>
      </div>
    </div>
  );
}

export function Chat({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { data: organization, isPending: organizationPending } = authClient.useActiveOrganization();
  const setup = useOrganizationSetup();

  useEffect(() => {
    if (!isPending && !session) router.replace('/login');
  }, [isPending, router, session]);

  if (isPending || organizationPending || !session) {
    return (
      <Shell fill>
        <div className="m-auto w-full max-w-3xl space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </Shell>
    );
  }
  if (!organization) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold">Choose an organization</h1>
            <CardDescription>The agent always works inside one organization.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (setup.isPending || setup.isFetching) {
    return (
      <Shell fill>
        <p className="m-auto p-6 text-sm text-muted-foreground">Checking organization setup…</p>
      </Shell>
    );
  }
  if (setup.data?.status !== 'ready') {
    return (
      <Shell fill>
        <p className="m-auto p-6 text-sm text-muted-foreground">
          Chat will be available when organization setup is complete.
        </p>
      </Shell>
    );
  }

  const scope = `${session.user.id}:${organization.id}`;
  return (
    <Shell fill>
      <ChatSession
        key={`${scope}:${sessionId ?? 'new'}`}
        sessionId={sessionId}
        scope={scope}
        organizationName={organization.name}
      />
    </Shell>
  );
}
