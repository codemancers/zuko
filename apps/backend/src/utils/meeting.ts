import { BadRequestException } from '@nestjs/common';
import { MeetingPlatform } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(timezone);
dayjs.extend(utc);

export function getPlatformFromUrl(url: string): MeetingPlatform {
  const lowerUrl = url.toLowerCase();

  if (
    lowerUrl.includes('meet.google.com') ||
    lowerUrl.includes('google.com/meet')
  ) {
    return MeetingPlatform.GOOGLE_MEET;
  }

  if (lowerUrl.includes('zoom.us')) {
    return MeetingPlatform.ZOOM;
  }

  if (lowerUrl.includes('teams.microsoft.com')) {
    return MeetingPlatform.MS_TEAMS;
  }

  throw new BadRequestException('Unsupported platform');
}

export function generateUtcCronExpression(
  localStartTime: string,
  localTimeZone: string,
): string {
  const startTime = dayjs(localStartTime).tz(localTimeZone).utc();

  const minute = startTime.minute();
  const hour = startTime.hour();
  const dayOfMonth = startTime.date();
  const month = startTime.month() + 1;

  return `${minute} ${hour} ${dayOfMonth} ${month} *`;
}
