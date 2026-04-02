import { Injectable } from "@nestjs/common";
import { BaseService } from "../../common/base/base.service";
import * as WebSocket from "ws";
import { EventEmitter } from "events";

@Injectable()
export class WebSocketService extends BaseService {
  private wss: WebSocket.Server | null = null;
  private participantsInfo: Map<string, any> = new Map();
  private messageEmitter = new EventEmitter();

  constructor() {
    super("WebSocketService");
  }

  async startServer(port: number): Promise<EventEmitter> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port }, () => {
          this.logger.log(`WebSocket server started on port ${port}`);
          resolve(this.messageEmitter);
        });

        this.wss.on("connection", (ws: WebSocket) => {
          this.logger.log("WebSocket client connected");
          this.handleConnection(ws);
        });

        this.wss.on("error", (error) => {
          this.logger.error("WebSocket server error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stopServer() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private handleConnection(ws: WebSocket) {
    ws.on("message", (data: Buffer) => {
      this.handleMessage(data);
    });

    ws.on("close", () => {
      this.logger.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      this.logger.error("WebSocket connection error:", error);
    });
  }

  private handleMessage(data: Buffer) {
    if (data.length < 4) {
      this.logger.warn("Received message too short to contain type");
      return;
    }

    const messageType = data.readInt32LE(0);
    switch (messageType) {
      case 1: // JSON
        this.handleJsonMessage(data);
        break;
      case 2: // VIDEO
        //TODO: Handle VIDEO data
        break;
      case 3: // MIXED_AUDIO
        //TODO: Handle MIXED_AUDIO data
        break;
      case 4: // ENCODED_MP4_CHUNK
        //TODO: Handle ENCODED_MP4_CHUNK data
        break;
      case 5: // PER_PARTICIPANT_AUDIO
        this.handlePerParticipantAudioFrame(data);
        break;
      default:
        this.logger.warn(`Unknown message type: ${messageType}`);
    }
  }

  private handleJsonMessage(data: Buffer) {
    try {
      const jsonData = JSON.parse(data.subarray(4).toString("utf-8"));
      switch (jsonData.type) {
        case "UsersUpdate":
          this.handleUsersUpdate(jsonData);
          break;
        case "ChatMessage":
          this.messageEmitter.emit("chatMessage", jsonData);
          break;
        case "MeetingStatusChange":
          if (jsonData.change === "removed_from_meeting")
            this.messageEmitter.emit("meetingEnded");
          if (jsonData.change === "meeting_ended")
            this.messageEmitter.emit("meetingEnded");
          break;
      }
    } catch (error) {
      this.logger.error("Error parsing JSON message:", error);
    }
  }

  private handleUsersUpdate(jsonData: any) {
    for (const user of jsonData.newUsers || []) {
      user.active = user.humanized_status === "in_meeting";
      this.participantsInfo.set(user.deviceId, user);
    }

    for (const user of jsonData.removedUsers || []) {
      user.active = false;
      this.participantsInfo.set(user.deviceId, user);
    }

    for (const user of jsonData.updatedUsers || []) {
      user.active = user.humanized_status === "in_meeting";
      this.participantsInfo.set(user.deviceId, user);
    }
  }

  private handlePerParticipantAudioFrame(message: Buffer) {
    try {
      if (message.length > 12) {
        const participantIdLength = message.readUInt8(4);

        // Extract participant ID (UTF-8)
        const participantId = message
          .subarray(5, 5 + participantIdLength)
          .toString("utf-8");

        const audioStart = 5 + participantIdLength;
        const audioLength = message.length - audioStart;

        // Copy audio bytes into new buffer to ensure proper alignment
        const audioCopy = Buffer.alloc(audioLength);
        message.copy(audioCopy, 0, audioStart);

        // Convert to Float32Array (now safe)
        const float32Buffer = new Float32Array(
          audioCopy.buffer,
          audioCopy.byteOffset,
          audioCopy.length / 4
        );

        // Convert Float32 to Int16 PCM
        const int16Array = new Int16Array(float32Buffer.length);
        for (let i = 0; i < float32Buffer.length; i++) {
          let val = float32Buffer[i] * 32768;
          val = Math.max(-32768, Math.min(32767, val));
          int16Array[i] = val;
        }

        const audioBytes = Buffer.from(int16Array.buffer);

        this.messageEmitter.emit("participantAudio", {
          participantId,
          audioData: audioBytes,
        });
      }
    } catch (error) {
      this.logger.error("Error while sending per person audio", error);
    }
  }

  getParticipantsInfo(): Map<string, any> {
    return this.participantsInfo;
  }

  getParticipant(participantId: string): any {
    return this.participantsInfo.get(participantId);
  }
}
