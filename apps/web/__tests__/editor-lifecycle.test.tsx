/** @vitest-environment jsdom */
import React from 'react';
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { OutputData } from '@editorjs/editorjs';
import Editor from '@/components/Common/Editor/Editor';
vi.unmock('@/components/Common/Editor/Editor');

const instances = vi.hoisted(
  () =>
    [] as Array<{
      change: () => Promise<void>;
      save?: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    }>,
);
vi.mock('@editorjs/editorjs', () => ({
  default: class {
    isReady = Promise.resolve();
    save: ReturnType<typeof vi.fn> | undefined = vi
      .fn()
      .mockResolvedValue({ blocks: [] });
    destroy = vi.fn(() => {
      this.save = undefined;
    });
    change: () => Promise<void>;
    constructor(options: { onChange: () => Promise<void> }) {
      this.change = options.onChange;
      instances.push(this);
    }
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  instances.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

it('ignores a queued change event after the editor has been destroyed', async () => {
  const onChange = vi.fn();
  const view = render(<Editor holder="queued-change" onChange={onChange} />);
  const editor = instances[0];
  view.unmount();
  await act(() => vi.runAllTimersAsync());
  expect(editor.destroy).toHaveBeenCalledOnce();
  expect(editor.save).toBeUndefined();
  await expect(editor.change()).resolves.toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
});

it('does not deliver an in-flight save after unmount', async () => {
  const onChange = vi.fn();
  const view = render(<Editor holder="pending-save" onChange={onChange} />);
  let resolve!: (data: OutputData) => void;
  instances[0].save!.mockReturnValue(
    new Promise<OutputData>((done) => {
      resolve = done;
    }),
  );
  const change = instances[0].change();
  view.unmount();
  resolve({ blocks: [] });
  await change;
  expect(onChange).not.toHaveBeenCalled();
  await act(() => vi.runAllTimersAsync());
});

it('still delivers changes from a live editor', async () => {
  const onChange = vi.fn();
  const view = render(<Editor holder="live-change" onChange={onChange} />);
  await instances[0].change();
  expect(onChange).toHaveBeenCalledWith({ blocks: [] });
  view.unmount();
  await act(() => vi.runAllTimersAsync());
});
