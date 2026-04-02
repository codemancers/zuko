import { z } from "zod";

export const MeetingSchema = z.object({
  url: z.string().min(1, "Meeting URL is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

export type MeetingDto = z.infer<typeof MeetingSchema>;

export const CallbackSchema = z.object({
  meetingId: z.string(),
  event: z.string(),
  data: z
    .object({
      recording: z.string().optional(),
      transcript: z.string().optional(),
      flyMachineId: z.string().optional(),
    })
    .optional(),
});
export type CallbackDto = z.infer<typeof CallbackSchema>;

export const TranscriptChunkSchema = z
  .object({
    text: z.string().default("").optional(),
    speaker_name: z.string().optional(),
    duration_seconds: z.number().optional(),
    sequence: z.number().int().optional(),
    isFinal: z.boolean().optional(),
  })
  .refine(
    (val) => val.isFinal || (val.text && val.text.trim().length > 0),
    {
      message: "text is required unless isFinal is true",
      path: ["text"],
    }
  );
export type TranscriptChunkDto = z.infer<typeof TranscriptChunkSchema>;
