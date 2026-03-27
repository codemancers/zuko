import { z } from "zod";

export const meetingSchema = z.object({
  meetingId: z.string().min(1, { message: "Meeting ID is required" }),
  meetingUrl: z.string().min(1, { message: "Meeting URL is required" }),
  callbackUrl: z.string().default(""),
  metadata: z.object({
    projectId: z.string().default(""),
  }).default({}),
});

export type MeetingSchema = z.infer<typeof meetingSchema>;
