export type TranscriptBufferConfig = {
  thresholdChars: number;
  overlapChars: number;
};

export class TranscriptBuffer {
  private buffer = '';
  private readonly thresholdChars: number;
  private readonly overlapChars: number;

  constructor(config: TranscriptBufferConfig) {
    this.thresholdChars = config.thresholdChars;
    this.overlapChars = config.overlapChars;
  }

  add(text: string, isFinal: boolean): string[] {
    const trimmed = text.trim();
    if (trimmed) {
      this.buffer = this.buffer ? `${this.buffer} ${trimmed}` : trimmed;
    }

    const chunks: string[] = [];
    while (this.buffer.length >= this.thresholdChars) {
      let chunk: string;
      if (this.overlapChars > 0 && this.buffer.length > this.overlapChars) {
        const flushLength = this.buffer.length - this.overlapChars;
        const lastSpace = this.buffer.lastIndexOf(' ', flushLength);
        const cut = lastSpace > flushLength - 500 ? lastSpace : flushLength;
        chunk = this.buffer.slice(0, cut).trim();
        this.buffer = this.buffer.slice(cut).trim();
      } else {
        chunk = this.buffer;
        this.buffer = '';
      }

      if (chunk) {
        chunks.push(chunk);
      }
    }

    if (isFinal && this.buffer.trim()) {
      chunks.push(this.buffer.trim());
      this.buffer = '';
    }

    return chunks;
  }
}
