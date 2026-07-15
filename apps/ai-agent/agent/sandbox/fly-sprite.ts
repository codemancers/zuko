import { posix } from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { SpritesClient, type Sprite } from '@fly/sprites';
import { defineState } from 'eve/context';
import type {
  SandboxBackend,
  SandboxBackendCreateInput,
  SandboxBackendHandle,
  SandboxNetworkPolicy,
  SandboxSession,
} from 'eve/sandbox';
import { type EvePrincipal } from '../lib/eve-principal.js';
import { fetchClaudeOauth } from '../lib/zuko-api';

/**
 * Everything Fly-Sprite for the agent's sandbox, in one place:
 * - provisioning + connection helpers (also used by the claude-code spawn path)
 * - eve `defineSandbox` backend (`createFlySpriteBackend`, wired in sandbox.ts)
 * - the per-session ALS bridge (`ensureSessionSprite` / `requireSessionSprite`)
 *
 * eve exposes no way for a non-tool model (claude-code drives its OWN tools) to
 * reach eve's `defineSandbox` session — `getSandbox()` lives only on
 * tool/callback contexts. So the claude-code path provisions the sprite itself
 * via these helpers; the backend uses the SAME helpers + deterministic name, so
 * both converge on one per-session VM.
 */

const FLY_SPRITE_BACKEND_NAME = 'fly-sprite';

/** Where the agent (and the `claude` CLI) works inside the sprite. */
const WORKDIR = '/sandbox';

/** Absolute path the `claude` CLI reads OAuth from inside the sprite. */
const CLAUDE_CREDENTIALS_PATH = '/home/sprite/.claude/.credentials.json';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Serializable handle to a provisioned Fly Sprite — JSON-safe so it survives
 * durable-state serialization (nested in {@link ZukoSessionState}). */
interface SandboxState {
  readonly type: 'fly-sprite';
  readonly externalId: string;
  readonly workingDirectory: string;
  readonly createdAt: number;
}

/**
 * This session's durable record. Deliberately mirrors eve's own `eve.sandbox`
 * envelope (`{ backendName, sessionKey, metadata }`) so the two stay swappable —
 * `metadata.sandboxState` is byte-for-byte what eve's backend `captureState()`
 * carries. We also fold the claude conversation id in here, so one record holds
 * the whole session's sandbox identity instead of two loose state keys.
 */
interface ZukoSessionState {
  readonly backendName: typeof FLY_SPRITE_BACKEND_NAME;
  readonly sessionKey: string;
  readonly metadata: {
    readonly sandboxState: SandboxState;
    readonly claudeSessionId?: string;
  };
}

// ---------------------------------------------------------------------------
// Provisioning + connection helpers
// ---------------------------------------------------------------------------

function flyToken(): string {
  const t = process.env['SPRITES_TOKEN'];
  if (!t) {
    throw new Error('SPRITES_TOKEN required to provision a Fly Sprite');
  }
  return t;
}

/**
 * Provision a fresh Fly Sprite. Idempotent on 409 / "already exists" (per-session
 * names are deterministic, so a retried turn reconnects the same VM).
 */
async function provisionSprite(spriteName: string): Promise<SandboxState> {
  const client = new SpritesClient(flyToken(), {
    baseURL: 'https://api.sprites.dev',
    timeout: 300_000, // cold-boot can take a while
  });

  let externalId: string;
  try {
    const sprite = await client.createSprite(spriteName);
    externalId = sprite.name;
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('409') || msg.includes('already exists')) {
      externalId = spriteName;
    } else {
      throw err;
    }
  }

  return {
    type: 'fly-sprite',
    externalId,
    workingDirectory: WORKDIR,
    createdAt: Date.now(),
  };
}

/**
 * Reconnect to a sprite by name. Synchronous — `client.sprite()` just builds a
 * handle (transports connect lazily) — so the sync `spawnClaudeCodeProcess` hook
 * can call it in the model hot path.
 *
 * `controlMode` routes buffered `execFile`/`exec` (the SandboxSession `run`
 * path) through a pooled, persistent control connection that auto-falls-back to
 * a fresh WebSocket — fewer handshakes, one reused connection. It does NOT
 * touch `spawn` (the streaming model path stays per-command WS) and silently
 * no-ops if the server lacks control support.
 */
function connectSprite(externalId: string): Sprite {
  const client = new SpritesClient(flyToken(), {
    baseURL: 'https://api.sprites.dev',
    controlMode: true,
  });
  return client.sprite(externalId);
}

/** Fly sprite names must be lowercase [a-z0-9-]; eve session ids carry
 * uppercase + underscores (e.g. `wrun_01KW…`), so sanitize + cap at 63. */
function spriteNameForSession(sessionId: string): string {
  return `zuko-eve-${sessionId}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 63);
}

/** Resolve the Claude creds document to write into the sprite. The backend is
 * the SOLE source: with a principal we fetch that user's creds (a failed fetch
 * THROWS — no silent fallback to a shared token). Without a principal (only
 * eve's own sandbox lifecycle, which is unauthenticated) there are no creds to
 * write — returns `null`. */
export async function resolveClaudeCredsJson(
  principal?: EvePrincipal,
): Promise<string | null> {
  if (!principal) return null;
  try {
    const blob = await fetchClaudeOauth(principal);
    return JSON.stringify({ claudeAiOauth: blob });
  } catch {
    // Claude not linked — CLI falls back to CLAUDE_CODE_OAUTH_TOKEN env var
    return null;
  }
}

/**
 * Prepare a connected sprite: create the workdir + write the Claude OAuth creds.
 * Idempotent. Creds come from the backend (per-user, keyed by `principal`); with
 * no principal none are written. When absent, the CLI falls back to
 * `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` forwarded via the spawn env.
 */
async function prepareSprite(
  sprite: Sprite,
  principal?: EvePrincipal,
): Promise<void> {
  const fs = sprite.filesystem('/');
  await fs.mkdir(WORKDIR, { recursive: true });
  const creds = await resolveClaudeCredsJson(principal);
  if (creds) {
    await fs.writeFile(CLAUDE_CREDENTIALS_PATH, creds, { mode: 0o600 });
  }
}

// ---------------------------------------------------------------------------
// eve InternalSandboxSession primitives (id / resolvePath / removePath /
// readFile→stream|null / writeFile←stream / spawn→AI-SDK SandboxProcess).
// rc37's native sprite.filesystem() does file I/O; sprite.spawn backs the proc.
// ---------------------------------------------------------------------------

/** Verbatim shape of eve's internal `SandboxRemovePathOptions` (not public). */
interface SandboxRemovePathOptions {
  readonly abortSignal?: AbortSignal;
  readonly force?: boolean;
  readonly path: string;
  readonly recursive?: boolean;
}

/**
 * One-shot Web stream over an already-buffered payload — a single chunk, so no
 * backpressure to manage. Node's `Readable.toWeb` covers the truly streaming
 * cases (command stdout/stderr); this covers the in-memory ones without the
 * `ArrayBufferLike`/`BlobPart` type friction `new Blob([buf]).stream()` hits.
 */
function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Return type intentionally inferred — annotating needs eve's non-public
 * `InternalSandboxSession`; `buildSession` validates it structurally. */
function toFlySpriteSession(
  sprite: Sprite,
  opts: { readonly id: string; readonly workingDirectory: string },
) {
  const fs = sprite.filesystem('/');

  function resolvePath(p: string): string {
    return posix.isAbsolute(p) ? p : posix.join(opts.workingDirectory, p);
  }

  return {
    get id(): string {
      return opts.id;
    },
    resolvePath,
    async removePath(options: SandboxRemovePathOptions): Promise<void> {
      await fs.rm(resolvePath(options.path), {
        recursive: options.recursive ?? false,
        force: options.force ?? false,
      });
    },
    async readFile(options: {
      path: string;
      abortSignal?: AbortSignal;
    }): Promise<ReadableStream<Uint8Array> | null> {
      try {
        const buf = await fs.readFile(resolvePath(options.path), null);
        return bytesToStream(buf);
      } catch {
        return null; // eve's contract: null when the file is absent
      }
    },
    async writeFile(options: {
      path: string;
      content: ReadableStream<Uint8Array>;
      abortSignal?: AbortSignal;
    }): Promise<void> {
      await fs.writeFile(
        resolvePath(options.path),
        await buffer(options.content),
      );
    },
    async spawn(options: {
      command: string;
      workingDirectory?: string;
      env?: Record<string, string>;
      abortSignal?: AbortSignal;
    }) {
      const cmd = sprite.spawn('sh', ['-c', options.command], {
        cwd: options.workingDirectory ?? opts.workingDirectory,
        ...(options.env ? { env: options.env } : {}),
      });
      if (options.abortSignal) {
        if (options.abortSignal.aborted) cmd.kill();
        else
          options.abortSignal.addEventListener('abort', () => cmd.kill(), {
            once: true,
          });
      }
      return {
        stdout: Readable.toWeb(cmd.stdout) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(cmd.stderr) as ReadableStream<Uint8Array>,
        wait: (): Promise<{ exitCode: number }> =>
          new Promise((resolve, reject) => {
            cmd.once('exit', (code: number) =>
              resolve({ exitCode: code ?? 0 }),
            );
            cmd.once('error', reject);
          }),
        kill: (): Promise<void> => {
          cmd.kill();
          return Promise.resolve();
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// buildSandboxSession replica (eve's is internal-only). Layers text/binary/run
// helpers over the InternalSandboxSession primitives above.
// ---------------------------------------------------------------------------

interface ReadTextFileLineOptions {
  startLine?: number;
  endLine?: number;
  encoding?: string;
}

function validateReadTextFileOptions(opts: ReadTextFileLineOptions): void {
  const { startLine, endLine } = opts;
  if (
    startLine !== undefined &&
    (!Number.isInteger(startLine) || startLine < 1)
  )
    throw new Error('startLine must be a positive integer (1-based).');
  if (endLine !== undefined && (!Number.isInteger(endLine) || endLine < 1))
    throw new Error('endLine must be a positive integer (1-based).');
  if (startLine !== undefined && endLine !== undefined && startLine > endLine)
    throw new Error('startLine must not be greater than endLine.');
}

function splitLinesPreservingEndings(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') {
      if (i + 1 < text.length && text[i + 1] === '\n') {
        lines.push(text.slice(start, i + 2));
        start = i + 2;
        i++;
      } else {
        lines.push(text.slice(start, i + 1));
        start = i + 1;
      }
    } else if (text[i] === '\n') {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function applyLineRange(text: string, opts: ReadTextFileLineOptions): string {
  if (opts.startLine === undefined && opts.endLine === undefined) return text;
  const lines = splitLinesPreservingEndings(text);
  const lineCount = lines.length;
  const start = opts.startLine ?? 1;
  const end = Math.min(opts.endLine ?? lineCount, lineCount);
  if (start > lineCount) return '';
  return lines.slice(start - 1, end).join('');
}

function decodeBytes(bytes: Uint8Array, encoding: string): string {
  if (encoding === 'utf-8' || encoding === 'utf8')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    encoding as BufferEncoding,
  );
}

function buildSession(
  sprite: Sprite,
  meta: { id: string; workingDirectory: string },
): SandboxSession {
  const primitives = toFlySpriteSession(sprite, meta);

  /**
   * Buffered command execution via `sprite.execFile` (not `spawn` + drain): it
   * buffers stdout/stderr with a maxBuffer guard and, thanks to `controlMode`,
   * runs over the pooled control connection. `execFile("sh", ["-c", …])` keeps
   * full shell semantics — `sprite.exec` naively whitespace-splits the command.
   */
  async function run(opts: { command: string; env?: Record<string, string> }) {
    const { stdout, stderr, exitCode } = await sprite.execFile(
      'sh',
      ['-c', opts.command],
      {
        cwd: meta.workingDirectory,
        ...(opts.env ? { env: opts.env } : {}),
      },
    );
    return {
      exitCode,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  }

  return {
    get id() {
      return primitives.id;
    },
    resolvePath(path: string) {
      return primitives.resolvePath(path);
    },
    run,
    async spawn(opts) {
      return primitives.spawn(opts);
    },
    async readFile(opts) {
      return primitives.readFile({
        abortSignal: opts.abortSignal,
        path: primitives.resolvePath(opts.path),
      });
    },
    async readBinaryFile(opts) {
      const stream = await primitives.readFile({
        abortSignal: opts.abortSignal,
        path: primitives.resolvePath(opts.path),
      });
      return stream === null ? null : await buffer(stream);
    },
    async readTextFile(opts) {
      validateReadTextFileOptions(opts);
      const stream = await primitives.readFile({
        abortSignal: opts.abortSignal,
        path: primitives.resolvePath(opts.path),
      });
      if (stream === null) return null;
      const buf = await buffer(stream);
      return applyLineRange(decodeBytes(buf, opts.encoding ?? 'utf-8'), {
        startLine: opts.startLine,
        endLine: opts.endLine,
        encoding: opts.encoding,
      });
    },
    async writeFile(opts) {
      await primitives.writeFile({
        abortSignal: opts.abortSignal,
        content: opts.content,
        path: primitives.resolvePath(opts.path),
      });
    },
    async writeBinaryFile(opts) {
      await primitives.writeFile({
        abortSignal: opts.abortSignal,
        content: bytesToStream(opts.content),
        path: primitives.resolvePath(opts.path),
      });
    },
    async writeTextFile(opts) {
      await primitives.writeFile({
        abortSignal: opts.abortSignal,
        content: bytesToStream(new TextEncoder().encode(opts.content)),
        path: primitives.resolvePath(opts.path),
      });
    },
    async removePath(opts) {
      await primitives.removePath({
        abortSignal: opts.abortSignal,
        force: opts.force,
        path: primitives.resolvePath(opts.path),
        recursive: opts.recursive,
      });
    },
    async setNetworkPolicy(policy: SandboxNetworkPolicy) {
      // Fail CLOSED: Fly Sprites have no firewall API, so we cannot enforce a
      // restrictive policy. Refuse anything but the wide-open default rather than
      // silently pretend to isolate the network (fail-open).
      if (policy !== 'allow-all') {
        throw new Error(
          `fly-sprite backend: cannot enforce network policy ${JSON.stringify(policy)} — Fly Sprites have no firewall API (only "allow-all" is honored).`,
        );
      }
    },
  } as SandboxSession;
}

// ---------------------------------------------------------------------------
// eve defineSandbox backend
// ---------------------------------------------------------------------------

function buildHandle(
  sprite: Sprite,
  state: SandboxState,
  sessionKey: string,
): SandboxBackendHandle {
  const session = buildSession(sprite, {
    id: state.externalId,
    workingDirectory: WORKDIR,
  });
  return {
    session,
    useSessionFn: async () => session,
    async captureState() {
      return {
        backendName: FLY_SPRITE_BACKEND_NAME,
        sessionKey,
        metadata: { sandboxState: state },
      };
    },
    async shutdown() {
      // No-op on eve-server shutdown. A Fly Sprite is remote compute that
      // auto-hibernates when idle and persists across turns, so it stays
      // reattachable from the captured `sandboxState` on the next server
      // start (eve's durable-session contract) — nothing to stop here.
    },
  };
}

/**
 * A `SandboxBackend` that provisions a per-session Fly Sprite. eve owns the
 * lifecycle: `create` on first turn, resume from captured `sandboxState` later.
 * Shares the sprite toolkit with the claude-code spawn path, so both converge on
 * the same per-session VM.
 */
export function createFlySpriteBackend(): SandboxBackend {
  return {
    name: FLY_SPRITE_BACKEND_NAME,
    async create(
      input: SandboxBackendCreateInput,
    ): Promise<SandboxBackendHandle> {
      const existing = input.existingMetadata?.['sandboxState'] as
        | SandboxState
        | undefined;
      const state =
        existing ??
        (await provisionSprite(spriteNameForSession(input.sessionKey)));
      const sprite = connectSprite(state.externalId);
      await prepareSprite(sprite);
      return buildHandle(sprite, state, input.sessionKey);
    },
    async prewarm() {
      // No prewarmed-template model for Fly Sprites; always create fresh.
      return { reused: false };
    },
  };
}

// ---------------------------------------------------------------------------
// Per-session ALS bridge for the claude-code spawn hook
// ---------------------------------------------------------------------------

/**
 * This session's durable record ({@link ZukoSessionState}). `defineState` is
 * DURABLE — serialized at the end of each step and restored across turns — so we
 * store only JSON-safe identifiers (the {@link SandboxState} reconnect record +
 * the claude conversation id), NEVER a live `Sprite` (a WebSocket handle that
 * can't serialize). ALS-scoped: resolves to THIS session even under concurrency.
 *
 * Named `zuko.session` to mirror eve's own `eve.sandbox` envelope; the `eve.`
 * prefix is reserved (`defineState` rejects it), so we namespace under `zuko.`.
 */
const sessionState = defineState<ZukoSessionState | null>(
  'zuko.session',
  () => null,
);

/**
 * Provision this session's sprite once and stash its serializable record. Called
 * from the `step.started` resolver, which eve awaits BEFORE each model call in
 * the session ALS. Idempotent: turn 1 provisions, later turns short-circuit on
 * the durable record — so a session reuses ONE VM (deterministic name; even a
 * cross-process resume reconnects the same sprite). Creds are fetched at most
 * once per session ONLY on success — a failed fetch throws before
 * `sessionState.update()` runs, so the durable record is never written and the
 * next turn retries the fetch. `principal`, when present (an authenticated
 * zuko user), routes creds through the backend instead of the env fallback —
 * see {@link resolveClaudeCredsJson}.
 */
export async function ensureSessionSprite(
  sessionId: string,
  principal?: EvePrincipal,
): Promise<void> {
  if (sessionState.get()) return;
  const sandboxState = await provisionSprite(spriteNameForSession(sessionId));
  await prepareSprite(connectSprite(sandboxState.externalId), principal);
  sessionState.update(() => ({
    backendName: FLY_SPRITE_BACKEND_NAME,
    sessionKey: sessionId,
    metadata: { sandboxState },
  }));
}

/** Synchronous accessor for the spawn hook — reconnects from the stored record
 * (`connectSprite` is sync + lazy). Throws if the resolver hasn't run. */
export function requireSessionSprite(): Sprite {
  const state = sessionState.get();
  if (!state) {
    throw new Error(
      'no session sprite — the step.started resolver (tools/ensure-session-sprite.ts) must run before the model call',
    );
  }
  return connectSprite(state.metadata.sandboxState.externalId);
}

/**
 * This session's `claude` conversation id, folded into the same durable record.
 * `undefined` until the first spawn mints one (see {@link setClaudeSessionId}).
 */
export function getClaudeSessionId(): string | undefined {
  return sessionState.get()?.metadata.claudeSessionId;
}

/** Persist this session's `claude` conversation id into the durable record so
 * later turns can `--resume` it. Requires {@link ensureSessionSprite} to have
 * run first (the record must already exist). */
export function setClaudeSessionId(claudeSessionId: string): void {
  sessionState.update((prev) => {
    if (!prev) {
      throw new Error(
        'no session record — ensureSessionSprite must run before setClaudeSessionId',
      );
    }
    return { ...prev, metadata: { ...prev.metadata, claudeSessionId } };
  });
}
