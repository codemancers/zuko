import { Injectable } from '@nestjs/common';

export interface IngestMeetingChunkParams {
  meetingId: string;
  organisationId: string;
  text: string;
}

/**
 * Stub: transcript ingestion into vector store is not yet configured for this environment.
 */
@Injectable()
export class MeetingTranscriptIngestService {
  async ingestChunk(_params: IngestMeetingChunkParams): Promise<void> {
    // no-op: vector store not configured
  }
}
