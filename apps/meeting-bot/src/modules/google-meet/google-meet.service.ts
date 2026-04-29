import axios from "axios";
import { Injectable } from "@nestjs/common";
import { BaseService } from "../../common/base/base.service";
import type { MeetingSchema } from "../../common/schemas/meeting.schema";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { launch, getStream } from "puppeteer-stream";
import type {
  TranscriptionService,
  TranscriptData,
} from "../transcription/transcription.service";
import type { AwsService } from "../aws/aws.service";
import type { FlyService } from "../fly/fly.service";
import type { EventEmitter } from "events";
import * as fs from "fs";
import type { GoogleMeetHelper } from "./google-meet-helper";
import type { AudioService } from "../audio/audio.service";
import type { WebSocketService } from "../websocket/websocket.service";
import * as path from "path";
import { TranscriptBuffer } from "../../utils/transcript-buffer";

declare global {
  interface Window {
    ws?: {
      enableMediaSending?: () => void;
      disableMediaSending?: () => void;
    };
  }
}

export interface ChatMessage {
  user: {
    displayName: string;
    fullName: string;
    profilePicture: string;
  };
  text: string;
  timeStamp: number;
}

const ZUKO_CHAT_USER = {
  displayName: "Zuko AI",
  fullName: "Zuko Assistant",
  profilePicture: "",
};

const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
stealthPlugin.enabledEvasions.delete("media.codecs");

puppeteer.use(stealthPlugin);

@Injectable()
export class GoogleMeetService extends BaseService {
  private static readonly JOIN_REJECTED_ERROR = "JOIN_REJECTED_BY_HOST";
  private browser: any;
  private page: any;
  private transcriptEmitter: EventEmitter | null = null;
  private websocketEmitter: EventEmitter | null = null;
  private liveTranscripts: TranscriptData[] = [];
  private chatMessages: ChatMessage[] = [];
  private videoStream: any;
  private audioStream: any;
  private recordingWriteStream!: fs.WriteStream;
  private recordingFilePath!: string;
  private recordingKey!: string;
  private speakerPolling!: boolean;
  private maxAttempt = 15;
  private transcriptBuffer = new TranscriptBuffer({
    thresholdChars: 600,
    overlapChars: 100,
  });
  private transcriptChunkSequence = 0;

  private meetingDetails!: MeetingSchema;
  private shutdownCallback: (() => Promise<void>) | null = null;

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly awsService: AwsService,
    private readonly flyService: FlyService,
    private readonly googleMeetHelper: GoogleMeetHelper,
    private readonly audioService: AudioService,
    private readonly websocketService: WebSocketService
  ) {
    super("GoogleService");
  }

  private getZukoChatUser() {
    const participants = this.websocketService.getParticipantsInfo();
    const botParticipant = Array.from(participants.values()).find((participant) =>
      Boolean(participant?.isCurrentUser)
    );

    if (!botParticipant) return ZUKO_CHAT_USER;

    return {
      displayName:
        botParticipant.displayName ||
        botParticipant.fullName ||
        ZUKO_CHAT_USER.displayName,
      fullName:
        botParticipant.fullName ||
        botParticipant.displayName ||
        ZUKO_CHAT_USER.fullName,
      profilePicture:
        botParticipant.profilePicture || ZUKO_CHAT_USER.profilePicture,
    };
  }

  private async getBrowserInstance() {
    const windowSize = [1920, 1080];

    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--window-size=${windowSize[0]},${windowSize[1]}`,
      "--start-fullscreen",
      "--disable-extensions",
      "--disable-application-cache",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      // Keep CSS/device pixels deterministic across Chrome builds (stable vs CFT)
      "--force-device-scale-factor=1",
      "--high-dpi-support=1",
      "--allowlisted-extension-id=jjndjgheafjngoipoacpjgeicjeomjli",
    ];

    // Run in headless mode in production
    if (process.env.NODE_ENV === "production") args.push("--headless=chrome");

    this.browser = await launch(puppeteer, {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args,
      ignoreDefaultArgs: ["--enable-automation"],
      // Respect the actual Chrome window size rather than Puppeteer's default viewport.
      defaultViewport: null,
    });

    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions("https://meet.google.com/", [
      "microphone",
      "camera",
      "notifications",
    ]);
  }

  async scheduleMeetingJoin(meetingSchema: MeetingSchema) {
    // Don't launch fly worker in development mode
    if (process.env.NODE_ENV === "development") {
      setTimeout(async () => {
        this.joinMeeting(meetingSchema).catch((error: unknown) => {
          this.logger.error(
            `[Meeting - ${meetingSchema.meetingId}] Failed to join`,
            error
          );
        });
      }, 1000);
    } else {
      const response = await this.flyService.launchFlyWorker(meetingSchema);
      if (response.status !== 200) {
        this.logger.error(
          `[Meeting - ${meetingSchema.meetingId}] Failed to launch fly worker`,
          response.data
        );
        throw new Error("Failed to launch fly worker");
      } else {
        await this.callback(
          meetingSchema.callbackUrl,
          meetingSchema.meetingId.toString(),
          "fly-machine-launched",
          {
            flyMachineId: response.data.id,
          }
        );
      }
    }

    return {
      message: "Meeting scheduled",
    };
  }

  async joinMeeting(meetingSchema: MeetingSchema, attempt = 1): Promise<void> {
    const { meetingId, meetingUrl, callbackUrl } = meetingSchema;

    if (attempt > this.maxAttempt) {
      this.logger.error("Failed to join the call after max attempts");
      await this.callback(callbackUrl, meetingId, "failed");

      this.closeWebsocket();
      if (process.env.NODE_ENV === "production") {
        process.exit(0);
      }
      return;
    }

    const botName = process.env.BOT_NAME || "Zuko AI";
    this.meetingDetails = meetingSchema;

    this.logger.log("[Meeting] Starting process", {
      meetingId,
      meetingUrl,
      callbackUrl,
    });

    this.recordingFilePath = `${meetingId}_recording.webm`;
    // Store the initially captured WebM as-is. MediaRecorder (via puppeteer-stream)
    // outputs WebM without final duration/PTS, so players can't reliably seek and
    // some platforms have limited support. A backend background job will later
    // transcode this to a seekable, widely compatible MP4 and update meeting.recording.
    this.recordingKey = `meetings/${meetingId}/recording.webm`;

    try {
      try {
        const wsPort = await this.initilizeWebsocket();
        const windowSize = [1920, 1080];

        await this.getBrowserInstance();
        this.page = await this.browser.newPage();
        // Re-assert viewport for consistent rendering between Chrome distributions.
        await this.page.setViewport({
          width: windowSize[0],
          height: windowSize[1],
          deviceScaleFactor: 1,
        });

        // --- INJECT CHROMEDRIVER PAYLOAD ---
        const videoFrameSize = [1280, 720];
        const displayName = process.env.BOT_NAME || "Zuko AI";
        const shouldCreateDebugRecording = false;
        const recordingView = "gallery_view";
        const addMixedAudioChunkCallback = true;
        const addAudioChunkCallback = true;
        const initialDataCode = `window.initialData = {websocketPort: ${wsPort}, videoFrameWidth: ${
          videoFrameSize[0]
        }, videoFrameHeight: ${videoFrameSize[1]}, botName: ${JSON.stringify(
          displayName
        )}, addClickRipple: ${
          shouldCreateDebugRecording ? "true" : "false"
        }, recordingView: '${recordingView}', sendMixedAudio: ${
          addMixedAudioChunkCallback ? "true" : "false"
        }, sendPerParticipantAudio: ${
          addAudioChunkCallback ? "true" : "false"
        }, collectCaptions: ${addAudioChunkCallback ? "false" : "true"}};`;

        // Load CDN libraries
        const protobufUrl =
          "https://cdnjs.cloudflare.com/ajax/libs/protobufjs/7.4.0/protobuf.min.js";
        const pakoUrl =
          "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js";
        const protobufCode = (await axios.get(protobufUrl)).data;
        const pakoCode = (await axios.get(pakoUrl)).data;

        // Read payload file
        // In production (Docker/Fly), we only ship `dist/`, so this must resolve
        // relative to the built output directory.
        const payloadPath = path.join(
          __dirname,
          "utils",
          "google-meet-chrome-driver.js"
        );
        const payloadCode = fs.readFileSync(payloadPath, "utf-8");

        // Combine all code
        const combinedCode = `\n${initialDataCode}\n${protobufCode}\n${pakoCode}\n${payloadCode}`;
        await this.page.evaluateOnNewDocument(combinedCode);

        this.logger.log(`[Meeting - ${meetingId}] Navigating to meeting URL`);
        await this.page.goto(meetingUrl, { waitUntil: "networkidle2" });

        this.logger.log(
          `[Meeting - ${meetingId}] Attempting to disable camera and microphone`
        );
        try {
          await this.page.click('[aria-label="Turn off camera"]');
          await this.page.click('[aria-label="Turn off microphone"]');
          this.logger.log(
            `[Meeting - ${meetingId}] Camera and microphone disabled`
          );
        } catch (error) {
          this.logger.error(
            `[Meeting - ${meetingId}] Failed to disable camera and microphone`,
            error
          );
        }

        await this.page.evaluate(() => {
          return new Promise((resolve) => setTimeout(resolve, 2000));
        });

        const nameInputSelector =
          'input[aria-label="Your name"], input[name="identifier"], input[type="text"]';
        const nameInput = await this.page.$(nameInputSelector);
        if (nameInput) {
          await nameInput.click({ clickCount: 3 });
          await nameInput.type(botName, { delay: 100 });
          this.logger.log(`[Meeting - ${meetingId}] Set bot name to Zuko AI`);
        }

        const joinButton = (await this.page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          return buttons.find(
            (button) =>
              button.textContent?.includes("Join now") ||
              button.textContent?.includes("Ask to join")
          );
        })) as any;

        if (!joinButton) {
          throw new Error("Failed to find join button");
        }

        await joinButton.asElement().click();
        this.logger.log(`[Meeting - ${meetingId}] Join button clicked`);

        // Wait for meeting to load
        try {
          await Promise.race([
            this.page.waitForSelector('[data-panel-id="1"]', {
              timeout: 600000,
            }),
            this.page.waitForSelector('div[role="main"]', { timeout: 600000 }),
            this.page.waitForSelector('button[aria-label*="Share screen"]', {
              timeout: 600000,
            }),
            this.page.waitForFunction(
              () => {
                const text = document.body.innerText.toLocaleLowerCase();
                return (
                  text.includes("people") || text.includes("in the meeting")
                );
              },
              { timeout: 600000 }
            ),
            this.page
              .waitForFunction(
                () => {
                  const text = document.body?.innerText?.toLowerCase() || "";
                  return (
                    text.includes(
                      "someone in the call denied your request to join"
                    ) ||
                    text.includes("you can't join this call") ||
                    text.includes("you can't join this meeting") ||
                    text.includes("you were denied entry") ||
                    text.includes("you've been denied entry") ||
                    text.includes("the host has removed you")
                  );
                },
                { timeout: 600000 }
              )
              .then(() => {
                throw new Error(GoogleMeetService.JOIN_REJECTED_ERROR);
              }),
          ]);
          this.logger.log(
            `[Meeting - ${meetingId}] Successfully joined meeting`
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === GoogleMeetService.JOIN_REJECTED_ERROR
          ) {
            throw error;
          }
          throw new Error("Failed to join meeting", { cause: error });
        }
      } catch (error) {
        const rejectedByError =
          error instanceof Error &&
          error.message === GoogleMeetService.JOIN_REJECTED_ERROR;

        const rejectedByHost = await this.page
          ?.evaluate(() => {
            const text = document.body?.innerText?.toLowerCase() || "";
            return (
              text.includes("you can't join this call") ||
              text.includes("you can't join this meeting") ||
              text.includes("you were denied entry") ||
              text.includes("you've been denied entry") ||
              text.includes("someone in the call denied your request to join") ||
              text.includes("the host has removed you")
            );
          })
          .catch(() => false);

        if (rejectedByError || rejectedByHost) {
          await this.cleanupPartialState();
          this.logger.log(
            `[Meeting - ${meetingId}] Bot was rejected by host, skipping retry`
          );
          await this.callback(callbackUrl, meetingId, "rejected");

          this.closeWebsocket();
          if (process.env.NODE_ENV === "production") {
            process.exit(0);
          }
          return;
        }

        this.logger.error("Failed to join the meeting", error);

        await this.cleanupPartialState();

        // retry
        return await this.joinMeeting(meetingSchema, attempt + 1);
      }

      await this.page.evaluate(() => {
        window.ws?.enableMediaSending?.();
      });

      await this.callback(callbackUrl, meetingId, "in_progress");

      // Check if there is an "Others may see your video differently" popup and close it by selecting the "Got it" button. If it's not there, then continue.
      await this.googleMeetHelper.dismissVideoDiffersPopup(this.page);

      await this.googleMeetHelper.sendMessageToMeetChat(
        this.page,
        "Hey Folks, Zuko AI is here to help you with your meeting. Say 'Hey Zuko AI' and ask me anything. or type @zuko to start a conversation."
      );

      // re-check in case it appears late
      setTimeout(
        () =>
          this.googleMeetHelper
            .dismissVideoDiffersPopup(this.page)
            .catch(() => {
              // ignore
            }),
        4000
      );

      // Initialize live transcription
      this.logger.log(
        `[Meeting - ${meetingId}] Initializing live transcription`
      );

      // Start transcription
      await this.startTranscription();

      this.recordingWriteStream = fs.createWriteStream(this.recordingFilePath);

      this.videoStream = await getStream(this.page, {
        audio: true,
        video: true,
      });
      this.logger.log(`[Meeting - ${meetingId}] Recording started`);

      // Speaker Timeline Tracking
      const speakerTimeline: { timestamp: number; speaker: string | null }[] =
        [];
      this.speakerPolling = true;
      const pollIntervalMs = 100;
      const meetingStartTime = Date.now() / 1000;
      let currentSpeaker: string | null = null;

      const pollSpeaker = async () => {
        while (this.speakerPolling) {
          const speaker = await this.googleMeetHelper.getActiveSpeaker(
            this.page
          );

          if (speaker !== currentSpeaker) {
            currentSpeaker = speaker;
            const currentTime = Date.now() / 1000;
            const relativeTimestamp = currentTime - meetingStartTime;
            speakerTimeline.push({ timestamp: relativeTimestamp, speaker });
          }
          await new Promise((res) => setTimeout(res, pollIntervalMs));
        }
      };

      pollSpeaker().catch((err) =>
        this.logger.error("Polling speaker failed", err)
      );

      this.audioStream = this.audioService.extractAudioFromStream(
        this.videoStream
      );

      this.videoStream.on("data", (chunk: Buffer) => {
        this.recordingWriteStream.write(chunk);
      });

      this.videoStream.on("end", () => {
        this.logger.log(`[Recording] VideoStream ended`);
      });

      this.videoStream.on("error", (err: Error) => {
        this.logger.error(`[Recording] VideoStream error`, err);
      });

      this.audioStream.stdout.on("data", (audioChunk: Buffer) => {
        if (this.transcriptEmitter) {
          const currentTime = Date.now() / 1000;
          const relativeTimestamp = currentTime - meetingStartTime;
          let speakerForChunk = null;
          for (let i = speakerTimeline.length - 1; i >= 0; i--) {
            if (speakerTimeline[i].timestamp <= relativeTimestamp) {
              speakerForChunk = speakerTimeline[i].speaker;
              break;
            }
          }
          if (speakerForChunk === null) {
            speakerForChunk = currentSpeaker;
          }
          this.transcriptEmitter.emit("audio", {
            chunk: audioChunk,
            speaker: speakerForChunk,
          });
        }
      });

      this.audioStream.stdout.on("end", () => {
        this.logger.log(`[Audio] AudioStream stdout ended`);
      });

      this.audioStream.stderr.on("data", (err: Buffer) => {
        this.logger.error(`[Audio] ffmpeg stderr`, err.toString());
      });

      await this.checkAndAutoLeave();

      return;
    } catch (error) {
      this.logger.error(`[Meeting - ${meetingId}] Error:`, error);

      if (this.videoStream) this.videoStream.destroy();
      if (this.transcriptEmitter) this.transcriptEmitter.emit("close");

      await this.browser.close();
      await this.callback(callbackUrl, meetingId, "failed");
      throw error;
    }
  }

  async callback(
    callbackUrl: string,
    meetingId: string,
    event: string,
    data?: { recording?: string; transcript?: string; flyMachineId?: string }
  ) {
    if (!callbackUrl) return;

    try {
      await axios.post(callbackUrl, {
        meetingId,
        event,
        data,
      });
    } catch (error) {
      this.logger.error(
        `[Meeting - ${meetingId}] Callback error:`,
        JSON.stringify((error as { response?: { data?: unknown } })?.response?.data, null, 2)
      );
    }
  }

  private async sendTranscriptChunks(chunks: string[]): Promise<void> {
    const backendUrl = process.env.BACKEND_URL;
    const agentToken = process.env.AGENT_TOKEN;
    if (!backendUrl || !agentToken) {
      this.logger.warn(
        `[Meeting - ${this.meetingDetails.meetingId}] Skipping transcript chunks: BACKEND_URL or AGENT_TOKEN not set`
      );
      return;
    }

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const sequence = ++this.transcriptChunkSequence;
      try {
        await axios.post(
          `${backendUrl}/api/meetings/${this.meetingDetails.meetingId}/transcript-chunks`,
          {
            text: chunk,
            sequence,
            isFinal: false,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-agent-token": agentToken,
              "x-user-provider": "google-meet",
            },
            timeout: 5000,
          }
        );
        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] Transcript chunk sent (sequence ${sequence})`
        );
      } catch (err) {
        this.logger.warn(
          `[Meeting - ${this.meetingDetails.meetingId}] Failed to send transcript chunk:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  async startTranscription() {
    this.transcriptEmitter = await this.transcriptionService.liveTranscription(
      this.meetingDetails.meetingId
    );

    // Handle transcription events
    this.transcriptEmitter.on("transcript", async (data) => {
      this.liveTranscripts.push(data);

      this.logger.log(
        `[Speaker - ${data.speaker_name}] , Duration: ${data.formatted_duration} seconds , Text: ${data.text}`
      );

      const chunks = this.transcriptBuffer.add(data.text, false);
      if (chunks.length > 0) {
        void this.sendTranscriptChunks(chunks);
      }

      const cleanTranscript = data.text
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (
        ["hey zuko", "hello zuko"].some((keyword) =>
          cleanTranscript.includes(keyword)
        )
      ) {
        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] Hello Zuko detected`
        );
        await this.googleMeetHelper.handleHeyZuko(
          this.page,
          data.text,
          String(this.meetingDetails.meetingId)
        );
      }
    });

    this.transcriptEmitter.on("error", (error) => {
      this.logger.error(
        `[Meeting - ${this.meetingDetails.meetingId}] Transcription error:`,
        error
      );
    });
  }

  async initilizeWebsocket() {
    const wsPort = 8765;
    // --- Start WebSocket server for payload communication ---
    this.websocketEmitter = await this.websocketService.startServer(wsPort);
    this.logger.log(
      `[Meeting - ${this.meetingDetails.meetingId}] WebSocket server started on port ${wsPort}`
    );

    this.websocketEmitter.on("chatMessage", async (data) => {
      const user = this.websocketService.getParticipant(data.participant_uuid);

      const chatData: ChatMessage = {
        user: {
          displayName: user?.displayName || user?.fullName || "Unknown",
          fullName: user?.fullName || user?.displayName || "Unknown",
          profilePicture: user?.profilePicture || "",
        },
        text: data.text,
        timeStamp: data.timeStamp || data.timestamp || Date.now(),
      };

      this.chatMessages.push(chatData);

      if (chatData.text?.toLowerCase().includes("@zuko")) {
        const requestorName =
          chatData.user.displayName || chatData.user.fullName || "Unknown user";
        const zukoReply = await this.googleMeetHelper.handleHeyZuko(
          this.page,
          data.text,
          String(this.meetingDetails.meetingId),
          requestorName
        );

        this.chatMessages.push({
          user: this.getZukoChatUser(),
          text: zukoReply,
          timeStamp: Date.now(),
        });
      }
    });

    this.websocketEmitter.on("meetingEnded", async () => {
      this.logger.log(
        `[Meeting - ${this.meetingDetails.meetingId}] - Leaving call (meeting ended)`
      );
      await this.cleanup();
      this.logger.log(
        `[Meeting - ${this.meetingDetails.meetingId}] - Recorded successfully`
      );

      // Use shutdown callback if available, otherwise exit directly
      if (this.shutdownCallback) {
        await this.shutdownCallback();
      } else if (process.env.NODE_ENV === "production") {
        process.exit(0);
      }
    });

    return wsPort;
  }

  async closeWebsocket() {
    await this.websocketService.stopServer();
    this.logger.log(`WebSocket server stopped`);
  }

  async cleanup() {
    try {
      this.speakerPolling = false;

      await this.page.evaluate(() => {
        window.ws?.disableMediaSending?.();
      });

      if (this.videoStream) this.videoStream.destroy();
      if (this.audioStream) this.audioStream.kill("SIGINT");

      if (this.recordingWriteStream) {
        this.recordingWriteStream.end();
        await new Promise<void>((resolve, reject) => {
          this.recordingWriteStream.on("finish", resolve);
          this.recordingWriteStream.on("error", reject);
        });
      }

      await this.closeWebsocket();

      await this.callback(
        this.meetingDetails.callbackUrl,
        this.meetingDetails.meetingId,
        "processing"
      );

      if (this.browser) await this.browser.close();

      // 1) Upload transcript first so we never lose it even if video upload fails.
      const transcriptKey = `meetings/${this.meetingDetails.meetingId}/transcript.json`;
      await this.awsService.uploadToS3(
        process.env.AWS_BUCKET_NAME ?? "",
        transcriptKey,
        JSON.stringify({
          transcripts: this.liveTranscripts,
          chatMessages: this.chatMessages,
          meetingId: this.meetingDetails.meetingId,
          createdAt: new Date().toISOString(),
        })
      );

      this.logger.log(
        `[Meeting - ${this.meetingDetails.meetingId}] - Transcript uploaded to S3`
      );

      // 2) Upload raw WebM recording as-is. Backend will transcode it asynchronously.
      this.logger.log(
        `[Meeting - ${this.meetingDetails.meetingId}] - Uploading raw recording to S3`
      );

      if (fs.existsSync(this.recordingFilePath)) {
        const fileBuffer = fs.readFileSync(this.recordingFilePath);
        await this.awsService.uploadToS3(
          process.env.AWS_BUCKET_NAME ?? "",
          this.recordingKey,
          fileBuffer
        );

        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] - Raw recording uploaded to S3`
        );

        fs.unlinkSync(this.recordingFilePath);
        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] - Local recording file cleaned up`
        );
      } else {
        this.logger.warn(
          `[Meeting - ${this.meetingDetails.meetingId}] - Recording file not found on disk`
        );
      }

      // 3) Before marking processing/completed, flush any remaining transcript
      // buffer from this meeting-bot instance so the tail isn't lost.
      const finalChunks = this.transcriptBuffer.add("", true);
      if (finalChunks.length > 0) {
        await this.sendTranscriptChunks(finalChunks);
        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] Transcript buffer final flush sent (${finalChunks.length} chunks)`
        );
      }

      // 4) Notify backend that meeting artifacts are ready.
      await this.callback(
        this.meetingDetails.callbackUrl,
        this.meetingDetails.meetingId,
        "completed",
        {
          recording: this.recordingKey,
          transcript: transcriptKey,
        }
      );

      // Close the video stream and transcript emitter
      if (this.videoStream) this.videoStream.destroy();
      if (this.transcriptEmitter) this.transcriptEmitter.emit("close");

      this.logger.log(
        `[Meeting - ${this.meetingDetails.meetingId}] Cleanup completed`
      );
    } catch (error) {
      await this.callback(
        this.meetingDetails.callbackUrl,
        this.meetingDetails.meetingId,
        "failed"
      );
      if (this.videoStream) this.videoStream.destroy();
      if (this.transcriptEmitter) this.transcriptEmitter.emit("close");
      if (this.browser) await this.browser.close();

      throw error;
    }
  }

  async cleanupPartialState() {
    if (this.transcriptEmitter) {
      this.transcriptEmitter.removeAllListeners();
      this.transcriptEmitter.emit("close");
      this.transcriptEmitter = null;
    }

    if (this.websocketEmitter) {
      this.websocketEmitter.removeAllListeners();
      this.websocketEmitter.emit("close");
      this.websocketEmitter = null;
    }

    await this.closeWebsocket();

    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkAndAutoLeave() {
    const intervalMs =
      process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 5000;

    const statusCheckInterval = setInterval(async () => {
      // Check if there is no other participaths in call
      const participants = this.websocketService.getParticipantsInfo();
      const inMeetingCount = Array.from(participants.values()).filter(
        (participant) => participant.humanized_status === "in_meeting"
      ).length;

      if (inMeetingCount < 2) {
        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] - Auto-leaving call (no other participants)`
        );
        clearInterval(statusCheckInterval);
        await this.cleanup();

        this.logger.log(
          `[Meeting - ${this.meetingDetails.meetingId}] - Recorded successfully`
        );

        // Use shutdown callback if available (for proper cleanup), otherwise exit directly
        if (this.shutdownCallback) {
          await this.shutdownCallback();
        } else if (process.env.NODE_ENV === "production") {
          process.exit(0);
        }
      }
    }, intervalMs);
  }

  setShutdownCallback(callback: () => Promise<void>) {
    this.shutdownCallback = callback;
  }
}
