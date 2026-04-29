import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class AudioService extends BaseService {
  constructor() {
    super('AudioService');
  }
  async extractAudio(videoPath: string, audioOutputPath: string): Promise<any> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    return new Promise((resolve, reject) => {
      const ffmpegExtract = spawn('ffmpeg', [
        '-i',
        videoPath,
        '-q:a',
        '0',
        '-map',
        'a',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '44100',
        '-ac',
        '2',
        audioOutputPath,
      ]);

      ffmpegExtract.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
  }

  extractAudioFromStream(videoStream: NodeJS.ReadableStream) {
    const sampleRate = 16000;
    const channels = 1;

    const ffmpeg = spawn('ffmpeg', [
      '-loglevel',
      'error',
      '-hide_banner',
      '-i',
      'pipe:0',
      '-f',
      'wav',
      '-acodec',
      'pcm_s16le',
      '-ar',
      sampleRate.toString(),
      '-ac',
      channels.toString(),
      'pipe:1',
    ]);

    videoStream
      .on('error', (err) => {
        this.logger.error('Stream Error', err);
      })
      .pipe(ffmpeg.stdin);

    ffmpeg.on('close', (code) => {
      this.logger.log(`[AudioService] ffmpeg process exited with code ${code}`);
    });

    return ffmpeg;
  }
}
