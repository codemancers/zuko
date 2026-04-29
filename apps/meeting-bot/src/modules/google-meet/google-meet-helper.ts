import { BaseService } from '../../common/base/base.service';
import type { Page } from 'puppeteer-core';
import { Injectable } from '@nestjs/common';
import axios from 'axios';

declare global {
  interface Window {
    sendChatMessage: (message: string) => void;
  }
}

@Injectable()
export class GoogleMeetHelper extends BaseService {
  private thread!: string;

  constructor() {
    super('GoogleMeetHelper');
  }

  async checkMeetingStatus(page: Page): Promise<boolean> {
    try {
      if (!page.isClosed()) {
        const result = await page.evaluate(() => {
          const inMeeting = !!document.querySelector(
            'button[aria-label*="Leave call"]',
          );
          const participantCount = document.querySelectorAll(
            '[data-participant-id]',
          ).length;
          return { inMeeting, participantCount };
        });

        return result.inMeeting && result.participantCount > 1;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check status: ${(error as Error).message}`);
      return false;
    }
  }

  async getActiveSpeaker(page: Page): Promise<string | null> {
    try {
      // TODO: Current approch is working but this class selector may change in the future, so we need to find a better way to get the active speaker.
      const activeSpeakerElements = await page.$$('.kssMZb');

      for (const element of activeSpeakerElements) {
        const nameSpan = await element.$('span.notranslate');
        if (nameSpan) {
          const speakerName = await page.evaluate(
            (el: Element) => el.textContent,
            nameSpan,
          );
          if (speakerName && speakerName.trim()) {
            return speakerName.trim();
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        '[Active Speaker] Error getting active speaker:',
        error,
      );
      return null;
    }
  }

  async sendMessageToMeetChat(page: Page, message: string) {
    await page.evaluate((msg: string) => {
      window.sendChatMessage?.(msg);
    }, message);
  }

  async handleHeyZuko(
    page: Page,
    query: string,
    meetingId: string,
    requestorName?: string,
  ): Promise<string> {
    this.sendMessageToMeetChat(
      page,
      '✨ Let me Zuko that for you… hang tight! ⏳',
    );

    try {
      this.logger.log(
        `[HeyZuko] Starting run for meetingId=${meetingId}, query="${query}"`,
      );

      if (!this.thread) {
        const response = await axios.post(
          `${process.env.BACKEND_URL}/api/threads`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              'x-agent-token': process.env.AGENT_TOKEN,
              'x-user-provider': 'google-meet',
              Accept: '*/*',
            },
          },
        );

        this.thread = response.data.thread_id;
      }

      const body = {
        input: {
          messages: { role: 'user', content: query },
        },
        context: {
          userContext: {
            meetingId,
            provider: 'google-meet',
          },
        },
        assistant_id: 'deep-agent',
      };

      this.logger.log(
        `[HeyZuko] Sending run with userContext=${JSON.stringify(
          body.context.userContext,
        )}`,
      );

      const response = await axios.post(
        `${process.env.BACKEND_URL}/api/threads/${this.thread}/runs/wait`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-agent-token': process.env.AGENT_TOKEN,
            'x-user-provider': 'google-meet',
            Accept: '*/*',
          },
        },
      );

      const messages = response.data.messages;
      const finalResponse = messages[messages.length - 1].content;
      const replyPrefix = requestorName ? `Replying to ${requestorName}` : '';
      const zukoReply = replyPrefix
        ? `🤖 ${replyPrefix}\n\n${finalResponse}`
        : `🤖 ${finalResponse}`;

      await this.sendMessageToMeetChat(page, zukoReply);
      return zukoReply;
    } catch (error) {
      this.logger.error('OpenAI error:', error);
      const errorMessage =
        '⚠️ Sorry, there was an error generating a response.';
      await this.sendMessageToMeetChat(page, errorMessage);
      return errorMessage;
    }
  }

  async dismissVideoDiffersPopup(
    page: Page,
    opts?: { timeoutMs?: number; pollMs?: number },
  ) {
    const timeoutMs = opts?.timeoutMs ?? 20_000; // overall cap
    const pollMs = opts?.pollMs ?? 250;
    const start = Date.now();

    const clickOkInside = async () => {
      return page.evaluate(() => {
        const dialogs = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"], div[aria-modal="true"]',
          ),
        );
        for (const dlg of dialogs) {
          let btn = dlg.querySelector<HTMLButtonElement>(
            'button[data-mdc-dialog-action="ok"]',
          );
          if (!btn) {
            const candidates = Array.from(
              dlg.querySelectorAll<HTMLButtonElement>('button'),
            );
            btn =
              candidates.find((b) =>
                (b.textContent || '').trim().toLowerCase().includes('got it'),
              ) ??
              candidates.find((b) =>
                (b.getAttribute('aria-label') || '')
                  .toLowerCase()
                  .includes('got it'),
              ) ??
              null;
          }
          if (btn && !btn.disabled) {
            btn.click();
            return true;
          }
        }
        return false;
      });
    };

    try {
      await page.waitForSelector('[role="dialog"], div[aria-modal="true"]', {
        timeout: 3000,
      });
    } catch {
      /* no-op, we’ll poll anyway */
    }

    while (Date.now() - start < timeoutMs) {
      try {
        const clicked = await clickOkInside();
        if (clicked) {
          await page
            .waitForFunction(
              () =>
                !document.querySelector(
                  '[role="dialog"], div[aria-modal="true"]',
                ),
              { timeout: 3000 },
            )
            .catch(() => {
              // it's fine if it lingers; we attempted a click
            });
          return true;
        }
      } catch {
        // DOM changed mid-eval; ignore and retry
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    return false;
  }
}
