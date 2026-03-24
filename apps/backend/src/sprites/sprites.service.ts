import { Injectable, InternalServerErrorException } from "@nestjs/common";

/** Shape returned by POST/GET https://api.sprites.dev/v1/sprites */
export type SpriteRecord = {
  id: string;
  name: string;
  organization: string;
  url: string;
  url_settings?: { auth?: string };
  status: string;
  created_at: string;
  updated_at: string;
  last_started_at?: string | null;
  last_active_at?: string | null;
};

/**
 * POST /v1/sprites/{name}/exec — non-TTY HTTP exec.
 * @see https://sprites.dev/api/sprites/exec#execute-command-post
 */
export type ExecPostOptions = {
  /** Command and arguments; sent as repeated `cmd` query parameters. */
  cmd: string[];
  /** Explicit path to executable (defaults to first `cmd` or bash). */
  path?: string;
  /** When true, the request body is passed as stdin to the process. */
  stdin?: boolean;
  /** Stdin payload when `stdin` is true (empty string if omitted). */
  stdinBody?: string | Uint8Array;
  /** Working directory for the command. */
  dir?: string;
  /** Environment entries as KEY=value, sent as repeated `env` query params. */
  env?: Record<string, string>;
};

/**
 * Exec POST often returns raw stdout/stderr text; it may also return JSON.
 * Always read `raw`; use `json` when the API sent parseable JSON.
 */
export type ExecPostResult = {
  raw: string;
  json?: unknown;
};

const DEFAULT_API_BASE = "https://api.sprites.dev";

@Injectable()
export class SpritesService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (
      process.env.SPRITES_API_BASE_URL ?? DEFAULT_API_BASE
    ).replace(/\/$/, "");
  }

  private bearerHeaders(): Record<string, string> {
    const token = process.env.SPRITES_TOKEN;
    if (!token) {
      throw new InternalServerErrorException("SPRITES_TOKEN is not configured");
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private jsonHeaders(): Record<string, string> {
    return {
      ...this.bearerHeaders(),
      "Content-Type": "application/json",
    };
  }

  private spriteName(threadId: string): string {
    return `zuko-${threadId}`;
  }

  async createSprite(threadId: string): Promise<SpriteRecord> {
    const name = this.spriteName(threadId);
    const res = await fetch(`${this.baseUrl}/v1/sprites`, {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(
        `Sprites API create failed (${res.status}): ${text}`,
      );
    }
    return (await res.json()) as SpriteRecord;
  }

  async getSprite(threadId: string): Promise<SpriteRecord> {
    const name = encodeURIComponent(this.spriteName(threadId));
    const res = await fetch(`${this.baseUrl}/v1/sprites/${name}`, {
      method: "GET",
      headers: this.bearerHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(
        `Sprites API get failed (${res.status}): ${text}`,
      );
    }
    return (await res.json()) as SpriteRecord;
  }

  private async parseExecPostBody(res: Response): Promise<ExecPostResult> {
    const raw = await res.text();
    const type = res.headers.get("content-type") ?? "";
    const trimmed = raw.trim();

    if (type.includes("application/json") && trimmed) {
      try {
        return { raw, json: JSON.parse(trimmed) as unknown };
      } catch {
        return { raw };
      }
    }

    if (
      trimmed &&
      ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")))
    ) {
      try {
        return { raw, json: JSON.parse(trimmed) as unknown };
      } catch {
        return { raw };
      }
    }

    return { raw };
  }

  /**
   * Run a one-shot command via HTTP POST (non-TTY only).
   * The response body is usually plain text (command output), not JSON.
   */
  async executeCommandPost(
    threadId: string,
    options: ExecPostOptions,
  ): Promise<ExecPostResult> {
    if (!options.cmd.length) {
      throw new InternalServerErrorException(
        "Sprites exec POST requires at least one cmd segment",
      );
    }

    const name = encodeURIComponent(this.spriteName(threadId));
    const params = new URLSearchParams();
    for (const part of options.cmd) {
      params.append("cmd", part);
    }
    if (options.path !== undefined) {
      params.set("path", options.path);
    }
    if (options.stdin === true) {
      params.set("stdin", "true");
    }
    if (options.dir !== undefined) {
      params.set("dir", options.dir);
    }
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        params.append("env", `${key}=${value}`);
      }
    }

    const headers: Record<string, string> = this.bearerHeaders();
    let body: string | Uint8Array | undefined;
    if (options.stdin) {
      body = options.stdinBody ?? "";
      headers["Content-Type"] = "application/octet-stream";
    }

    const res = await fetch(
      `${this.baseUrl}/v1/sprites/${name}/exec?${params.toString()}`,
      { method: "POST", headers, body },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(
        `Sprites API exec POST failed (${res.status}): ${text}`,
      );
    }
    return this.parseExecPostBody(res);
  }

  async setupSprite(threadId: string): Promise<void> {
    // clone the repo
    await this.executeCommandPost(threadId, {
      cmd: ["git", "clone", "https://github.com/codemancers/zuko.git"],
      env: this.getEnvironmentVariables(),
    });

    console.log("repo cloned");
    // install dependencies
    try {
      await this.executeCommandPost(threadId, {
        cmd: ["bun install --prefix ./zuko"],
        env: this.getEnvironmentVariables(),
      });
    } catch (error) {
      console.error("error installing dependencies", error);
      throw new InternalServerErrorException("error installing dependencies");
    }
    console.log("dependencies installed");

    // start the server
    await this.executeCommandPost(threadId, {
      cmd: ["bunx nx dev ai-agents"],
      env: this.getEnvironmentVariables(),
    });
  }

  private getEnvironmentVariables(): Record<string, string> {
    return {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4.1",
    };
  }
}
