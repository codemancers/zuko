import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/meeting",
})
export class MeetingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingGateway.name);
  private bots = new Map<string, string>(); // meetingId -> socketId

  handleConnection(client: Socket) {
    this.logger.log(`Bot connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Bot disconnected: ${client.id}`);

    // Clean up mapping when bot disconnects
    for (const [meetingId, socketId] of this.bots.entries()) {
      if (socketId === client.id) {
        this.bots.delete(meetingId);
        this.logger.log(`Removed bot mapping for meeting: ${meetingId}`);
        break;
      }
    }
  }

  @SubscribeMessage("BOT_READY")
  handleBotReady(client: Socket, payload: { meetingId: string }) {
    this.logger.log(
      `Bot ready for meeting: ${payload.meetingId}, socket: ${client.id}`
    );
    this.bots.set(payload.meetingId, client.id);
  }

  sendEnd(meetingId: string): boolean {
    const socketId = this.bots.get(meetingId);

    if (!socketId) {
      this.logger.warn(`No bot found for meeting: ${meetingId}`);
      return false;
    }

    this.logger.log(`Sending END command to bot for meeting: ${meetingId}`);
    this.server.to(socketId).emit("END");
    return true;
  }
}
