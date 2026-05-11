import { Injectable } from '@nestjs/common';

/**
 * Tracks one active AbortController per chat.
 * Prevents parallel agent runs and enables the stop endpoint.
 */
@Injectable()
export class ChatStreamRegistry {
  private readonly active = new Map<number, AbortController>();

  /**
   * Claims a slot for the given chat. If a run is already active it is
   * aborted first (last-write-wins — new message supersedes old one).
   * Returns an AbortController whose signal should be passed to the agent.
   */
  claim(chatId: number): AbortController {
    const existing = this.active.get(chatId);
    if (existing) {
      existing.abort();
    }
    const controller = new AbortController();
    this.active.set(chatId, controller);
    return controller;
  }

  /**
   * Releases the slot after the run completes. No-op if the stored
   * controller no longer matches (e.g. a newer run already claimed it).
   */
  release(chatId: number, controller: AbortController): void {
    if (this.active.get(chatId) === controller) {
      this.active.delete(chatId);
    }
  }

  /**
   * Aborts the active run for the given chat, if any.
   * Called by the stop endpoint.
   */
  stop(chatId: number): void {
    const controller = this.active.get(chatId);
    if (controller) {
      controller.abort();
      this.active.delete(chatId);
    }
  }
}
