'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, ClipboardIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
  Text,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
} from '@zuko/ui-kit';

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

type Agent = {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  instructions: string;
  getConfig: (endpoint: string, token: string) => string;
};

const AGENTS: Agent[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    icon: <Image src="/icons/claude.svg" alt="Claude" width={16} height={16} />,
    language: 'bash',
    instructions: 'Run this once in your terminal.',
    getConfig: (ep, tk) =>
      `claude mcp add --transport http ZukoCRM ${ep} \\\n  --header "Authorization: Bearer ${tk}"`,
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    icon: <OpenAIIcon />,
    language: 'toml',
    instructions: 'Add to ~/.codex/config.toml, then restart Codex.',
    getConfig: (ep, tk) =>
      `[mcp_servers.ZukoCRM]\n  url = "${ep}"\n  [mcp_servers.ZukoCRM.headers]\n    Authorization = "Bearer ${tk}"`,
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    icon: (
      <Image
        src="/icons/gemini-cli.svg"
        alt="Gemini CLI"
        width={16}
        height={16}
      />
    ),
    language: 'json',
    instructions: 'Add to ~/.gemini/settings.json, then restart Gemini.',
    getConfig: (ep, tk) =>
      JSON.stringify(
        {
          mcpServers: {
            ZukoCRM: {
              httpUrl: ep,
              headers: { Authorization: `Bearer ${tk}` },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: <Image src="/icons/cursor.svg" alt="Cursor" width={16} height={16} />,
    language: 'json',
    instructions:
      'Add to ~/.cursor/mcp.json (global) or .cursor/mcp.json (project), then restart Cursor.',
    getConfig: (ep, tk) =>
      JSON.stringify(
        {
          mcpServers: {
            ZukoCRM: { url: ep, headers: { Authorization: `Bearer ${tk}` } },
          },
        },
        null,
        2,
      ),
  },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function OpenAIIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.843-3.369 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.786a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.676zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  token: string;
};

const MASKED_BEARER_TOKEN = '***********';

export function McpSetupModal({ open, onClose, endpoint, token }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = AGENTS[activeIndex];
  const config = current.getConfig(endpoint, token);
  const displayConfig = current.getConfig(endpoint, MASKED_BEARER_TOKEN);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(config).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [config]);

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <DialogTitle>Connect to your AI coding agent</DialogTitle>
      <DialogDescription>
        Pick your agent and copy the config — that&apos;s it.
      </DialogDescription>

      <DialogBody>
        <Tabs
          selectedIndex={activeIndex}
          onChange={(i) => {
            setActiveIndex(i as number);
            setCopied(false);
          }}
        >
          <TabsList
            variant="line"
            className="mb-4 gap-8 flex justify-start items-start"
          >
            {AGENTS.map((agent) => (
              <TabsTrigger
                key={agent.id}
                value={agent.id}
                className="cursor-pointer px-4"
              >
                <span className="flex items-center gap-2">
                  <span className="shrink-0">{agent.icon}</span>
                  {agent.name}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsPanels>
            {AGENTS.map((agent) => (
              <TabsContent key={agent.id} value={agent.id} className="h-72">
                <Text className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {agent.instructions}
                </Text>

                <div className="relative rounded-xl bg-zinc-950 dark:bg-zinc-800/60 px-4 py-4 pr-12 font-mono text-sm text-zinc-100 overflow-x-auto whitespace-pre leading-relaxed">
                  {agent.id === current.id
                    ? displayConfig
                    : agent.getConfig(endpoint, MASKED_BEARER_TOKEN)}
                  <Button
                    plain
                    onClick={handleCopy}
                    aria-label="Copy"
                    className="!absolute !right-2 !top-2 !p-1.5 !text-zinc-400 hover:!text-zinc-100"
                  >
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-lime-400" />
                    ) : (
                      <ClipboardIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </TabsPanels>
        </Tabs>
      </DialogBody>

      <DialogActions>
        <Text className="mr-auto text-xs text-zinc-400">
          Token is tied to your account — keep it private.
        </Text>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
