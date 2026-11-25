import { vi } from 'vitest';

export class SetupStreamMock {
  static readonly CLOSED = 2;
  static instances: SetupStreamMock[] = [];
  readyState = 1;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    SetupStreamMock.instances.push(this);
  }
  close() {
    this.readyState = SetupStreamMock.CLOSED;
  }
  send(update: { status: string; message: string; step?: string }) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(update) }));
  }
}

export function installSetupStreamMock() {
  SetupStreamMock.instances = [];
  vi.stubGlobal('EventSource', SetupStreamMock);
}
