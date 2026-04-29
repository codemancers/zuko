import { Body, Controller, Post } from '@nestjs/common';
import type { GoogleMeetService } from './google-meet.service';
import { meetingSchema } from '../../common/schemas/meeting.schema';
import type { MeetingSchema } from '../../common/schemas/meeting.schema';

@Controller('google-meet')
export class GoogleMeetController {
  constructor(private readonly googleMeetService: GoogleMeetService) {}

  @Post('join')
  async joinMeeting(@Body() body: unknown) {
    const meetingData = meetingSchema.parse(body) satisfies MeetingSchema;
    return this.googleMeetService.scheduleMeetingJoin(meetingData);
  }
}
