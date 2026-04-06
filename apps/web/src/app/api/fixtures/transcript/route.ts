import { NextResponse } from 'next/server';

/**
 * Test fixture endpoint — serves static transcript JSON for e2e tests.
 * The e2e seed sets meeting.transcript to this URL so the NestJS backend
 * can fetch it during SSR without needing an external storage service.
 * Returns 404 in production so it has no effect on real deployments.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.json({
    transcripts: [
      {
        text: "Hello everyone, let's start the sync",
        speaker_name: 'Alice',
        formatted_duration: '00:00:05',
        is_final: true,
        speech_final: true,
        confidence: 1,
        timestamp: '00:00:05',
        speaker: 0,
        duration_seconds: 5,
      },
      {
        text: 'I have some updates on the UI refactor',
        speaker_name: 'Bob',
        formatted_duration: '00:00:30',
        is_final: true,
        speech_final: true,
        confidence: 1,
        timestamp: '00:00:30',
        speaker: 1,
        duration_seconds: 30,
      },
    ],
    chatMessages: [],
  });
}
