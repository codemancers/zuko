/**
 * Sandbox interface — abstracts over local Node.js execution (dev) and
 * remote Sprite execution (production).
 *
 * Modelled after gather's Sandbox interface so tools are portable.
 */

export interface ExecResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface StatResult {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
}

export interface DirEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink';
}

export interface Sandbox {
  /** The working directory inside the sandbox. */
  readonly workingDirectory: string;

  exec(
    command: string,
    cwd: string,
    timeoutMs: number,
    opts?: { signal?: AbortSignal },
  ): Promise<ExecResult>;

  readFile(
    path: string,
    opts?: { offset?: number; limit?: number },
  ): Promise<string>;

  writeFile(path: string, content: string): Promise<void>;

  glob(pattern: string, opts?: { cwd?: string }): Promise<string[]>;

  grep(
    pattern: string,
    opts: { path: string; glob?: string; caseSensitive?: boolean },
  ): Promise<Array<{ file: string; line: number; match: string }>>;

  stat(path: string): Promise<StatResult>;

  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;

  readdir(path: string): Promise<DirEntry[]>;
}

// ─── Local sandbox (runs on the machine where ai-agents is running) ───────────

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, join } from 'node:path';

const execAsync = promisify(exec);

export class LocalSandbox implements Sandbox {
  constructor(readonly workingDirectory: string) {}

  async exec(
    command: string,
    cwd: string,
    timeoutMs: number,
    opts?: { signal?: AbortSignal },
  ): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        env: { ...process.env },
        signal: opts?.signal,
      });
      return {
        success: true,
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (err: any) {
      return {
        success: false,
        exitCode: err.code ?? 1,
        stdout: (err.stdout ?? '').trim(),
        stderr: (err.stderr ?? err.message ?? '').trim(),
      };
    }
  }

  async readFile(
    path: string,
    opts?: { offset?: number; limit?: number },
  ): Promise<string> {
    const abs = path.startsWith('/')
      ? path
      : resolve(this.workingDirectory, path);
    const raw = readFileSync(abs, 'utf-8');
    const lines = raw.split('\n');
    const start = opts?.offset ?? 0;
    const slice =
      opts?.limit != null
        ? lines.slice(start, start + opts.limit)
        : lines.slice(start);
    return slice.map((line, i) => `${start + i + 1}\t${line}`).join('\n');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const abs = path.startsWith('/')
      ? path
      : resolve(this.workingDirectory, path);
    mkdirSync(resolve(abs, '..'), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
  }

  async glob(pattern: string, opts?: { cwd?: string }): Promise<string[]> {
    const base = opts?.cwd ?? this.workingDirectory;
    const results: string[] = [];
    const regex = patternToRegex(pattern);
    walk(base, base, regex, results);
    return results;
  }

  async grep(
    pattern: string,
    opts: { path: string; glob?: string; caseSensitive?: boolean },
  ): Promise<Array<{ file: string; line: number; match: string }>> {
    const base = opts.path.startsWith('/')
      ? opts.path
      : resolve(this.workingDirectory, opts.path);
    const flags = opts.caseSensitive ? '' : 'i';
    const re = new RegExp(pattern, flags);
    const globRe = opts.glob ? patternToRegex(opts.glob) : null;
    const matches: Array<{ file: string; line: number; match: string }> = [];
    grepWalk(base, base, re, globRe, matches);
    return matches;
  }

  async stat(path: string): Promise<StatResult> {
    const abs = path.startsWith('/')
      ? path
      : resolve(this.workingDirectory, path);
    const s = statSync(abs);
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      size: s.size,
      mtimeMs: s.mtimeMs,
    };
  }

  async mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
    const abs = path.startsWith('/')
      ? path
      : resolve(this.workingDirectory, path);
    mkdirSync(abs, { recursive: opts?.recursive ?? false });
  }

  async readdir(path: string): Promise<DirEntry[]> {
    const abs = path.startsWith('/')
      ? path
      : resolve(this.workingDirectory, path);
    const entries = readdirSync(abs, {
      withFileTypes: true,
      encoding: 'utf-8',
    });
    return (entries as import('node:fs').Dirent<string>[]).map((e) => ({
      name: e.name,
      type: (e.isFile()
        ? 'file'
        : e.isDirectory()
          ? 'directory'
          : 'symlink') as DirEntry['type'],
    }));
  }
}

function walk(root: string, dir: string, regex: RegExp, out: string[]) {
  for (const entry of readdirSync(dir, {
    withFileTypes: true,
    encoding: 'utf-8',
  }) as import('node:fs').Dirent<string>[]) {
    const rel = join(dir, entry.name).slice(root.length + 1);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(root, join(dir, entry.name), regex, out);
    } else if (regex.test(rel)) {
      out.push(rel);
    }
  }
}

function grepWalk(
  root: string,
  dir: string,
  pattern: RegExp,
  globRe: RegExp | null,
  out: Array<{ file: string; line: number; match: string }>,
) {
  for (const entry of readdirSync(dir, {
    withFileTypes: true,
    encoding: 'utf-8',
  }) as import('node:fs').Dirent<string>[]) {
    const abs = join(dir, entry.name);
    const rel = abs.slice(root.length + 1);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      grepWalk(root, abs, pattern, globRe, out);
    } else {
      if (globRe && !globRe.test(entry.name)) continue;
      try {
        const lines = readFileSync(abs, 'utf-8').split('\n');
        lines.forEach((line, i) => {
          if (pattern.test(line))
            out.push({ file: rel, line: i + 1, match: line });
        });
      } catch {
        /* skip unreadable */
      }
    }
  }
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  return new RegExp(escaped + '$');
}

// ─── Remote sandbox (routes through Sprites exec API) ────────────────────────

const SPRITES_API_BASE =
  process.env.SPRITES_API_BASE_URL ?? 'https://api.sprites.dev';

export class SpriteSandbox implements Sandbox {
  constructor(
    readonly workingDirectory: string,
    private readonly spriteName: string,
    private readonly token: string,
  ) {}

  private async execInSprite(cmd: string[]): Promise<string> {
    const params = new URLSearchParams();
    for (const part of cmd) params.append('cmd', part);
    const res = await fetch(
      `${SPRITES_API_BASE}/v1/sprites/${encodeURIComponent(this.spriteName)}/exec?${params}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    if (!res.ok)
      throw new Error(
        `Sprite exec failed (${res.status}): ${await res.text()}`,
      );
    return res.text();
  }

  async exec(
    command: string,
    cwd: string,
    _timeoutMs: number,
  ): Promise<ExecResult> {
    try {
      const stdout = await this.execInSprite(['bash', '-c', command]);
      return { success: true, exitCode: 0, stdout: stdout.trim(), stderr: '' };
    } catch (err: any) {
      return { success: false, exitCode: 1, stdout: '', stderr: err.message };
    }
  }

  async readFile(
    path: string,
    opts?: { offset?: number; limit?: number },
  ): Promise<string> {
    const abs = path.startsWith('/')
      ? path
      : `${this.workingDirectory}/${path}`;
    const url = new URL(
      `${SPRITES_API_BASE}/v1/sprites/${encodeURIComponent(this.spriteName)}/fs/read`,
    );
    url.searchParams.set('path', abs);
    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (!res.ok)
      throw new Error(
        `Sprite readFile failed (${res.status}): ${await res.text()}`,
      );
    const raw = await res.text();
    const lines = raw.split('\n');
    const start = opts?.offset ?? 0;
    const slice =
      opts?.limit != null
        ? lines.slice(start, start + opts.limit)
        : lines.slice(start);
    return slice.map((line, i) => `${start + i + 1}\t${line}`).join('\n');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const abs = path.startsWith('/')
      ? path
      : `${this.workingDirectory}/${path}`;
    const url = new URL(
      `${SPRITES_API_BASE}/v1/sprites/${encodeURIComponent(this.spriteName)}/fs/write`,
    );
    url.searchParams.set('path', abs);
    url.searchParams.set('mkdir', 'true');
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/octet-stream',
      },
      body: content,
    });
    if (!res.ok)
      throw new Error(
        `Sprite writeFile failed (${res.status}): ${await res.text()}`,
      );
  }

  async glob(pattern: string, opts?: { cwd?: string }): Promise<string[]> {
    const dir = opts?.cwd ?? this.workingDirectory;
    const out = await this.execInSprite([
      'bash',
      '-c',
      `find ${dir} -name '${pattern}' 2>/dev/null | sed 's|${dir}/||'`,
    ]);
    return out.split('\n').filter(Boolean);
  }

  async grep(
    pattern: string,
    opts: { path: string; glob?: string; caseSensitive?: boolean },
  ): Promise<Array<{ file: string; line: number; match: string }>> {
    const dir = opts.path.startsWith('/')
      ? opts.path
      : `${this.workingDirectory}/${opts.path}`;
    const flags = opts.caseSensitive ? '' : '-i';
    const include = opts.glob ? `--include='${opts.glob}'` : '';
    const out = await this.execInSprite([
      'bash',
      '-c',
      `grep -rn ${flags} ${include} '${pattern}' ${dir} 2>/dev/null || true`,
    ]);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+):(\d+):(.*)$/);
        return m
          ? {
              file: m[1].replace(dir + '/', ''),
              line: parseInt(m[2]),
              match: m[3],
            }
          : { file: '', line: 0, match: line };
      });
  }

  async stat(path: string): Promise<StatResult> {
    const abs = path.startsWith('/')
      ? path
      : `${this.workingDirectory}/${path}`;
    const out = await this.execInSprite([
      'bash',
      '-c',
      `stat -c '%F %s %Y' '${abs}'`,
    ]);
    const [typeStr, sizeStr, mtimeStr] = out.trim().split(' ');
    const isFile =
      typeStr === 'regular file' || typeStr === 'regular empty file';
    const isDirectory = typeStr === 'directory';
    return {
      isFile,
      isDirectory,
      size: parseInt(sizeStr ?? '0'),
      mtimeMs: parseInt(mtimeStr ?? '0') * 1000,
    };
  }

  async mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
    const abs = path.startsWith('/')
      ? path
      : `${this.workingDirectory}/${path}`;
    const flag = opts?.recursive ? '-p' : '';
    await this.execInSprite(['bash', '-c', `mkdir ${flag} '${abs}'`]);
  }

  async readdir(path: string): Promise<DirEntry[]> {
    const abs = path.startsWith('/')
      ? path
      : `${this.workingDirectory}/${path}`;
    const url = new URL(
      `${SPRITES_API_BASE}/v1/sprites/${encodeURIComponent(this.spriteName)}/fs/list`,
    );
    url.searchParams.set('path', abs);
    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (!res.ok)
      throw new Error(
        `Sprite readdir failed (${res.status}): ${await res.text()}`,
      );
    const data = (await res.json()) as {
      entries: Array<{ name: string; type: string }> | null;
    };
    return (data.entries ?? []).map((e) => ({
      name: e.name,
      type: (e.type === 'directory'
        ? 'directory'
        : e.type === 'symlink'
          ? 'symlink'
          : 'file') as DirEntry['type'],
    }));
  }
}
