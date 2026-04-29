/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module";
import { GoogleMeetService } from "./modules/google-meet/google-meet.service";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

async function bootstrap() {
  const meetingId = process.env.MEETING_ID;
  const meetingUrl = process.env.MEETING_URL;
  const callbackUrl = process.env.CALLBACK_URL || null;
  const backendWsUrl = process.env.BACKEND_URL || "http://localhost:3001";

  if (meetingId && meetingUrl) {
    const app = await NestFactory.createApplicationContext(AppModule);
    const googleMeetService = app.get(GoogleMeetService);
    const logger = new Logger("BotWebSocket");

    // Connect to backend WebSocket
    const socket: Socket = io(`${backendWsUrl}/meeting`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    let cleanupInProgress = false;

    // Shared shutdown function for both END command and auto-leave
    const shutdown = async () => {
      if (cleanupInProgress) {
        logger.warn("Shutdown already in progress");
        return;
      }

      cleanupInProgress = true;

      try {
        // Close WebSocket connection to backend
        socket.disconnect();

        // Close NestJS app context
        await app.close();

        // Exit process
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error}`);
        process.exit(1);
      }
    };

    // Set shutdown callback for auto-leave to use
    googleMeetService.setShutdownCallback(shutdown);

    socket.on("connect", () => {
      logger.log(`Connected to backend WebSocket for meeting: ${meetingId}`);

      // Register bot as ready
      socket.emit("BOT_READY", {
        type: "BOT_READY",
        meetingId: meetingId,
      });
    });

    socket.on("END", async () => {
      if (cleanupInProgress) {
        logger.warn("Cleanup already in progress, ignoring END command");
        return;
      }

      logger.log(`Received END command for meeting: ${meetingId}`);

      try {
        // Cleanup: leave meeting, upload recording, etc.
        await googleMeetService.cleanup();
        logger.log(`Meeting ${meetingId} ended successfully`);

        await shutdown();
      } catch (error) {
        logger.error(`Error during cleanup: ${error}`);
        process.exit(1);
      }
    });

    // Start the meeting
    await googleMeetService.joinMeeting({
      meetingId: meetingId,
      meetingUrl,
      callbackUrl: callbackUrl ?? "",
    });

    return;
  }

  const app = await NestFactory.create(AppModule);
  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
