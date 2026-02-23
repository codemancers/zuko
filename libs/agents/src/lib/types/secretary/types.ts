export interface Contact {
  name: string;
  email: string;
  resourceName?: string;
}

export interface ContactSearchResult {
  found: boolean;
  contact?: Contact;
  suggestions?: Contact[];
  message: string;
}

export interface CalendarEventInput {
  title: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  attendees: string[]; // email addresses
  description?: string;
  addMeetLink?: boolean;
}

export interface CalendarEventResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  meetLink?: string;
  message: string;
}

export interface MeetingRequest {
  attendeeName: string;
  dateTime: Date;
  durationMinutes?: number;
  title?: string;
  agenda?: string;
}

export interface MeetingConfirmation {
  title: string;
  startTime: Date;
  endTime: Date;
  attendee: Contact;
  agenda?: string;
  confirmed: boolean;
}
