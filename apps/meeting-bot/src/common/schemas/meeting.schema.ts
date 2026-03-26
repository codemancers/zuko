import { z } from "zod";

export const meetingSchema = z.object({
  meetingId: z.string().min(1, { message: "Meeting ID is required" }),
  meetingUrl: z.string().min(1, { message: "Meeting URL is required" }),
  callbackUrl: z.string().min(1, { message: "Callback URL is required" }),
  metadata: z.object({
    projectId: z.string().min(1, { message: "Project ID is required" }),
  }),
});

export type MeetingSchema = z.infer<typeof meetingSchema>;
