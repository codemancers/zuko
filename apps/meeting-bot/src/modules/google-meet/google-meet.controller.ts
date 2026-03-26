import { Body, Controller, Post } from "@nestjs/common";
import { GoogleMeetService } from "./google-meet.service";
import { MeetingSchema } from "../../common/schemas/meeting.schema";

@Controller("google-meet")
export class GoogleMeetController {
  constructor(private readonly googleMeetService: GoogleMeetService) {}

  @Post("join")
  async joinMeeting(@Body() meetingSchema: MeetingSchema) {
    return this.googleMeetService.scheduleMeetingJoin(meetingSchema);
  }
}
