import { Injectable } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import * as fs from 'fs';
import { BaseService } from '../../common/base/base.service';
import { EventEmitter } from 'events';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  confidence: number;
  timestamp: string;
  speaker: number;
  speaker_name?: string;
  duration_seconds: number;
  formatted_duration: string;
}

interface AudioData {
  chunk: any;
  speaker: string | null;
}

@Injectable()
export class TranscriptionService extends BaseService {
  private currentSpeaker: string | null = null;
  private currentTranscriptData: TranscriptData | null = null;
  private deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor() {
    super('TranscriptionService');
  }

  async transcribe(audioPath: string): Promise<any> {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(audioPath),
      {
        model: 'nova-3',
        language: 'en',
        summarize: 'v2',
        topics: true,
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        redact: ['pci', 'ssn'],
        diarize: true,
        filler_words: true,
      },
    );

    if (error) throw error;

    return result;
  }

  async liveTranscription(meetingId: string): Promise<EventEmitter> {
    const transcriptEmitter = new EventEmitter();
    let connection: any;

    try {
      connection = this.deepgram.listen.live({
        model: 'nova-3',
        language: 'en',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        endpointing: 300,
        keyterm: ['hey zuko', 'hello zuko'],
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        this.logger.log(
          `[Meeting - ${meetingId}] Live transcription connection opened`,
        );
        transcriptEmitter.emit('connected');

        // Start KeepAlive every 3 seconds to keep the connection alive
        this.keepAliveInterval = setInterval(() => {
          if (connection.getReadyState() === 1) {
            connection.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 3000);

        connection.on(
          LiveTranscriptionEvents.Transcript,
          (data: Record<string, any>) => {
            try {
              if (
                data.channel &&
                data.channel.alternatives &&
                data.channel.alternatives.length > 0
              ) {
                const transcript = data.channel.alternatives[0].transcript;

                if (
                  transcript &&
                  transcript.trim() &&
                  data.is_final &&
                  this.currentSpeaker
                ) {
                  // If the speaker has changed, emit the current transcript and reset the current transcript data
                  if (
                    this.currentTranscriptData &&
                    this.currentTranscriptData.speaker_name !==
                      this.currentSpeaker
                  ) {
                    transcriptEmitter.emit(
                      'transcript',
                      this.currentTranscriptData,
                    );
                    this.currentTranscriptData = null;
                  }

                  if (!this.currentTranscriptData) {
                    this.currentTranscriptData = {
                      text: transcript,
                      is_final: data.is_final,
                      speech_final: data.speech_final,
                      confidence: data.channel.alternatives[0].confidence,
                      timestamp: new Date().toISOString(),
                      speaker: data.channel.alternatives[0].speaker || 0,
                      speaker_name: this.currentSpeaker || 'Unknown',
                      duration_seconds: data.start + data.duration,
                      formatted_duration: this.formatDuration(
                        data.start + data.duration,
                      ),
                    };
                  } else {
                    // Append the transcript to the current transcript data till the next speaker is detected or the utterance ends
                    this.currentTranscriptData.text += ' ' + transcript;
                  }
                }
              }
            } catch (error) {
              this.logger.error(
                `[Meeting - ${meetingId}] Error processing transcript:`,
                error,
              );
            }
          },
        );

        connection.on(
          LiveTranscriptionEvents.UtteranceEnd,
          (_data: unknown) => {
            if (!this.currentTranscriptData) return;

            transcriptEmitter.emit('transcript', this.currentTranscriptData);

            this.currentTranscriptData = null;
          },
        );

        connection.on(LiveTranscriptionEvents.Error, (error: unknown) => {
          this.logger.error(
            `[Meeting - ${meetingId}] Transcription error:`,
            error,
          );
          transcriptEmitter.emit('error', error);
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
          this.logger.log(
            `[Meeting - ${meetingId}] Live transcription connection closed`,
          );
          transcriptEmitter.emit('closed');

          if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
          }
        });
      });

      transcriptEmitter.on('audio', (audioData: AudioData) => {
        if (connection.getReadyState() === 1) {
          this.currentSpeaker = audioData.speaker;

          connection.send(audioData.chunk);
        }
      });

      transcriptEmitter.on('close', () => {
        if (connection.getReadyState() === 1) {
          connection.requestClose();
        }
      });

      return transcriptEmitter;
    } catch (error) {
      this.logger.error(
        `[Meeting - ${meetingId}] Failed to initialize live transcription:`,
        error,
      );
      throw error;
    }
  }

  private formatDuration(durationInSeconds: number): string {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
}
