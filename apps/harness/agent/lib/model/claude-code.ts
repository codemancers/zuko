import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type {
  SpawnOptions,
  SpawnedProcess,
} from '@anthropic-ai/claude-agent-sdk';
import type { SpriteCommand } from '@fly/sprites';
import { createClaudeCode } from 'ai-sdk-provider-claude-code';
import {
  getClaudeSessionId,
  requireSessionSprite,
  setClaudeSessionId,
} from '../../sandbox/fly-sprite';

/** Where the `claude` CLI runs inside the sprite. */
const WORKDIR = '/sandbox';

/** The `claude` binary path inside the sprite image (not the host's). */
const CLAUDE_EXECUTABLE = '/home/sprite/.local/bin/claude';

/** claude CLI session-selection flags the provider may inject from its shared
 * capture; we strip them and substitute this session's own choice. */
const VALUE_FLAGS = new Set([
  '--resume',
  '--session-id',
  '--resume-session-at',
]);
const BOOL_FLAGS = new Set(['--fork-session', '--continue']);

/**
 * Rewrite the `claude` CLI args so this eve session uses its OWN conversation
 * id, never the shared model instance's captured one.
 *
 * The `ai-sdk-provider-claude-code` model is a module-level singleton shared by
 * every concurrent eve session and captures the claude session id on the
 * instance; a shared id would leak session A's conversation into session B's
 * fresh sprite (`--resume` → "No conversation found"). We own the id per
 * eve-session in the durable `gather.session` record (see fly-sprite.ts) and
 * substitute it here: first spawn mints a fresh id (`--session-id <uuid>`),
 * later spawns resume it (`--resume <uuid>`).
 */
function scopeSessionArgs(args: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (VALUE_FLAGS.has(arg)) {
      i++; // also drop the flag's value
      continue;
    }
    if (BOOL_FLAGS.has(arg)) continue;
    out.push(arg);
  }
  const existing = getClaudeSessionId();
  if (existing) {
    out.push('--resume', existing);
  } else {
    const id = randomUUID();
    setClaudeSessionId(id);
    out.push('--session-id', id);
  }
  return out;
}

/** Any Claude auth token the host explicitly set (fallback to the creds file
 * the sandbox backend writes into the sprite). */
function claudeAuthEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const oauth = process.env['CLAUDE_CODE_OAUTH_TOKEN'];
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (oauth) env['CLAUDE_CODE_OAUTH_TOKEN'] = oauth;
  if (apiKey) env['ANTHROPIC_API_KEY'] = apiKey;
  return env;
}

/** Locale/terminal vars safe to forward verbatim. */
const SAFE_ENV_KEYS = new Set(['LANG', 'LC_ALL', 'LC_CTYPE', 'TERM']);
/** Prefixes claude / the claude-code SDK legitimately read. */
const SAFE_ENV_PREFIXES = ['ANTHROPIC_', 'CLAUDE_AGENT_SDK_'];

/**
 * Build a curated env for the sprite-side `claude` CLI — default-deny.
 *
 * The provider forwards the eve HOST's entire `process.env`, which carries host
 * secrets (AWS keys, Google OAuth, DB URLs) that must NEVER cross the isolation
 * boundary into the sandbox, plus host-session `CLAUDE_CODE_*` vars whose paths
 * point at the host. We forward only an allowlist (locale + `ANTHROPIC_*`/
 * `CLAUDE_AGENT_SDK_*`), then pin sprite-correct `HOME`/`USER`/`PATH` (claude
 * reads OAuth from `$HOME/.claude`, so a leaked host `HOME` breaks auth).
 */
function buildSpawnEnv(env: SpawnOptions['env']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (
      SAFE_ENV_KEYS.has(k) ||
      SAFE_ENV_PREFIXES.some((p) => k.startsWith(p))
    ) {
      out[k] = v;
    }
  }
  return {
    ...out,
    ...claudeAuthEnv(),
    HOME: '/home/sprite',
    USER: 'sprite',
    PATH: '/home/sprite/.local/bin:/usr/local/bin:/usr/bin:/bin',
  };
}

/**
 * Adapt a Fly {@link SpriteCommand} to claude-code's {@link SpawnedProcess}.
 *
 * Two mismatches to bridge:
 * 1. Shape: `SpriteCommand.exitCode()` is a METHOD (returns -1 before exit)
 *    while `SpawnedProcess.exitCode` is a nullable PROPERTY, and `killed`
 *    doesn't exist on `SpriteCommand` — so we expose real getters.
 * 2. Timing: Fly connects the command's WebSocket asynchronously (~100-200ms),
 *    but the provider writes the init message to stdin synchronously right after
 *    spawn. Writing to `cmd.stdin` before the WS is open makes `SpriteCommand`
 *    emit a fatal "WebSocket not open" error ("ProcessTransport is not ready for
 *    writing"). We hand the provider a buffering `PassThrough` and only pipe it
 *    into the real stdin once `spawn` fires (WS open).
 */
function toSpawnedProcess(cmd: SpriteCommand): SpawnedProcess {
  let killed = false;
  const stdin = new PassThrough();
  cmd.once('spawn', () => stdin.pipe(cmd.stdin));
  const adapter = {
    stdin,
    stdout: cmd.stdout,
    get killed() {
      return killed;
    },
    get exitCode(): number | null {
      const code = cmd.exitCode();
      return code < 0 ? null : code;
    },
    kill(signal: NodeJS.Signals): boolean {
      killed = true;
      cmd.kill(signal);
      return true;
    },
    on(event: 'exit' | 'error', listener: (...args: never[]) => void): void {
      cmd.on(event, listener as (...a: unknown[]) => void);
    },
    once(event: 'exit' | 'error', listener: (...args: never[]) => void): void {
      cmd.once(event, listener as (...a: unknown[]) => void);
    },
    off(event: 'exit' | 'error', listener: (...args: never[]) => void): void {
      cmd.off(event, listener as (...a: unknown[]) => void);
    },
  };
  return adapter as unknown as SpawnedProcess;
}

/**
 * The synchronous `spawnClaudeCodeProcess` hook: spawn the `claude` CLI in THIS
 * session's sprite (provisioned + owned by eve's `defineSandbox`; reached via
 * the ALS bridge). `sprite.spawn` is synchronous (the transport connects
 * lazily), so no await in the model hot path. The CLI needs a full-duplex
 * process — writable stdin for streaming input, readable stdout for output.
 */
function spawnInSprite(opts: SpawnOptions): SpawnedProcess {
  const sprite = requireSessionSprite();
  const cmd = sprite.spawn(opts.command, scopeSessionArgs(opts.args), {
    cwd: opts.cwd ?? WORKDIR,
    env: buildSpawnEnv(opts.env),
  });
  // Fly's spawn takes no AbortSignal; bridge cancellation to a kill.
  if (opts.signal.aborted) {
    cmd.kill();
  } else {
    opts.signal.addEventListener('abort', () => cmd.kill(), { once: true });
  }
  return toSpawnedProcess(cmd);
}

/**
 * Claude Code as eve's model, spawned INSIDE this session's Fly Sprite. eve's
 * `model` slot accepts the AI SDK LanguageModel this produces; the synchronous
 * `spawnClaudeCodeProcess` hook runs the `claude` CLI in the sprite eve
 * provisioned (see the `sandbox/` folder). `bypassPermissions` is safe here —
 * the CLI runs inside the sprite's isolation boundary, not on the eve host.
 */
export const claudeCode = createClaudeCode({
  defaultSettings: {
    spawnClaudeCodeProcess: spawnInSprite,
    pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE,
    permissionMode: 'bypassPermissions',
  },
});
