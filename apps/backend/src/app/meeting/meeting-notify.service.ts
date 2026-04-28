import type {
  OnModuleDestroy,
  OnModuleInit} from "@nestjs/common";
import {
  Injectable,
  Logger
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import pg from "pg";
import type { MeetingGateway } from "./meeting.gateway";

const CHANNEL = "meeting_end";

/**
 * Uses Postgres LISTEN/NOTIFY so that when any backend instance calls endMeeting,
 * the instance that has the bot WebSocket for that meeting can emit END.
 * No Redis required; works across multiple backend machines.
 */
@Injectable()
export class MeetingNotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeetingNotifyService.name);
  /** Dedicated connection for LISTEN; must stay open to receive notifications. */
  private listenClient: pg.Client | null = null;
  /** Separate connection used only for sending NOTIFY (avoids blocking the listener). */
  private notifyPool: pg.Pool | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly meetingGateway: MeetingGateway
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connectAndListen();
    this.initNotifyPool();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.listenClient) {
      this.listenClient.removeAllListeners();
      this.listenClient
        .end()
        .catch((err) =>
          this.logger.debug("Listen client end error (ignored)", err)
        );
      this.listenClient = null;
    }
    if (this.notifyPool) {
      await this.notifyPool.end();
      this.notifyPool = null;
    }
  }

  private get connectionString(): string | undefined {
    return this.configService.get<string>("DATABASE_URL");
  }

  private initNotifyPool(): void {
    const connectionString = this.connectionString;
    if (!connectionString) return;
    this.notifyPool = new pg.Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 60000,
    });
  }

  private async connectAndListen(): Promise<void> {
    const connectionString = this.connectionString;
    if (!connectionString) {
      this.logger.warn(
        "DATABASE_URL not set; meeting end LISTEN/NOTIFY disabled"
      );
      return;
    }

    this.listenClient = new pg.Client({ connectionString });

    this.listenClient.on("notification", (msg: pg.Notification) => {
      if (msg.channel !== CHANNEL) return;
      try {
        const payload = JSON.parse(msg.payload ?? "{}");
        const meetingId = payload?.meetingId;
        if (!meetingId) {
          this.logger.warn(
            "meeting_end notification payload missing meetingId"
          );
          return;
        }
        this.meetingGateway.sendEnd(meetingId);
      } catch (e) {
        this.logger.warn("Invalid meeting_end notification payload", e);
      }
    });

    this.listenClient.on("error", (err) => {
      this.logger.error("Meeting notify listen client error", err);
    });

    this.listenClient.on("end", () => {
      this.listenClient = null;
      this.scheduleReconnect();
    });

    try {
      await this.listenClient.connect();
      await this.listenClient.query(`LISTEN ${CHANNEL}`);
      this.logger.log(`LISTEN ${CHANNEL} active`);
    } catch (err) {
      this.logger.error("Failed to connect/listen for meeting_end", err);
      this.listenClient = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connectAndListen();
    }, 5000);
  }

  /**
   * Notify all backends (including this one) that a meeting should end.
   * The instance that has the bot socket for this meeting will emit END.
   */
  async notifyMeetingEnd(meetingId: string): Promise<void> {
    const pool = this.notifyPool;
    if (!pool) {
      this.logger.warn(
        "Notify pool not initialized; cannot NOTIFY meeting_end"
      );
      return;
    }
    const payload = JSON.stringify({ meetingId });
    try {
      await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, payload]);
    } catch (err) {
      this.logger.error("Failed to NOTIFY meeting_end", err);
    }
  }
}
