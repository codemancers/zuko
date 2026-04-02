import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GoogleMeetModule } from "../modules/google-meet/google-meet.module";

@Module({
  imports: [GoogleMeetModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
