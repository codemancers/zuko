import { Module } from "@nestjs/common";
import { MeetingService } from "./meeting.service";
import { MeetingController } from "./meeting.controller";
import { MeetingTranscriptIngestService } from "./meeting-transcript-ingest.service";
import { MeetingGateway } from "./meeting.gateway";
import { MeetingNotifyService } from "./meeting-notify.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { OrganizationGuard } from "../../common/auth/organization.guard";

@Module({
  imports: [PrismaModule],
  controllers: [MeetingController],
  providers: [
    MeetingService,
    MeetingTranscriptIngestService,
    MeetingGateway,
    MeetingNotifyService,
    OrganizationGuard,
  ],
  exports: [MeetingService, MeetingGateway],
})
export class MeetingModule {}
