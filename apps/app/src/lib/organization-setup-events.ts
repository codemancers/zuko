import type { SetupProgress } from './organization-setup';

export type SetupConnection = 'connected' | 'reconnecting' | 'closed';

/** EventSource handles SSE parsing and reconnects; the query signal closes the subscription. */
export async function* organizationSetupEvents(
  url: string,
  signal: AbortSignal,
  onConnection: (connection: SetupConnection) => void,
): AsyncGenerator<SetupProgress> {
  if (signal.aborted) return;
  const source = new EventSource(url);
  const updates = new ReadableStream<SetupProgress>({
    start(controller) {
      source.onmessage = (event) => {
        try {
          const progress = JSON.parse(event.data) as SetupProgress;
          onConnection('connected');
          controller.enqueue(progress);
          if (progress.status === 'ready' || progress.status === 'failed') {
            source.close();
            controller.close();
          }
        } catch (error) {
          onConnection('closed');
          source.close();
          controller.error(error);
        }
      };
      source.onerror = () => {
        const closed = source.readyState === EventSource.CLOSED;
        onConnection(closed ? 'closed' : 'reconnecting');
        if (closed) controller.error(new Error('Setup progress connection closed.'));
      };
    },
    cancel() {
      source.close();
    },
  });
  const reader = updates.getReader();
  const abort = () => { void reader.cancel(); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    signal.removeEventListener('abort', abort);
    source.close();
    reader.releaseLock();
  }
}
