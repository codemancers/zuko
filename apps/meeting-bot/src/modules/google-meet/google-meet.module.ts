import { Module } from "@nestjs/common";
import { GoogleMeetController } from "./google-meet.controller";
import { GoogleMeetService } from "./google-meet.service";
import { TranscriptionModule } from "../transcription/transcription.module";
import { AudioModule } from "../audio/audio.module";
import { AwsModule } from "../aws/aws.module";
import { FlyModule } from "../fly/fly.module";
import { GoogleMeetHelper } from "./google-meet-helper";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    TranscriptionModule,
    AudioModule,
    AwsModule,
    FlyModule,
    WebSocketModule,
  ],
  controllers: [GoogleMeetController],
  providers: [GoogleMeetService, GoogleMeetHelper],
  exports: [GoogleMeetService],
})
export class GoogleMeetModule {}
