import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class MeetingDetailPage extends BasePage {
  readonly backButton: Locator;
  readonly meetingHeading: Locator;
  readonly recordingTab: Locator;
  readonly transcriptTab: Locator;
  readonly chatTab: Locator;
  readonly summaryTab: Locator;
  readonly actionItemsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.backButton = page.getByRole("button", { name: /meetings/i });
    this.meetingHeading = page.getByRole("heading", { level: 1 });
    this.recordingTab = page.getByRole("button", { name: /recording/i });
    this.transcriptTab = page.getByRole("button", { name: /transcript/i });
    this.chatTab = page.getByRole("button", { name: /^chat$/i });
    this.summaryTab = page.getByRole("button", { name: /summary/i });
    this.actionItemsTab = page.getByRole("button", { name: /action items/i });
  }

  override async goto(id: string) {
    // Intercept the meeting API response and inject transcript data so e2e tests
    // don't depend on an external transcript storage URL being accessible.
    await this.page.route(`**/api/proxy/meetings/${id}`, async (route) => {
      const response = await route.fetch();
      let meeting: Record<string, unknown> = {};
      try {
        meeting = await response.json();
      } catch {
        // fall through with empty object
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ...meeting,
          recordingUrl:
            (meeting.recordingUrl as string | null) ??
            "https://example.com/test-recording.mp4",
          transcriptData: [
            {
              text: "Hello everyone, let's start the sync",
              speaker_name: "Alice",
              formatted_duration: "00:00:05",
              is_final: true,
              speech_final: true,
              confidence: 1,
              timestamp: "00:00:05",
              speaker: 0,
              duration_seconds: 5,
            },
            {
              text: "I have some updates on the UI refactor",
              speaker_name: "Bob",
              formatted_duration: "00:00:30",
              is_final: true,
              speech_final: true,
              confidence: 1,
              timestamp: "00:00:30",
              speaker: 1,
              duration_seconds: 30,
            },
          ],
        }),
      });
    });
    await super.goto(`/meeting/${id}`);
  }

  async clickTab(name: "Recording" | "Transcript" | "Chat" | "Summary" | "Action Items") {
    const tab =
      name === "Recording"
        ? this.recordingTab
        : name === "Transcript"
          ? this.transcriptTab
          : name === "Chat"
            ? this.chatTab
            : name === "Summary"
              ? this.summaryTab
              : this.actionItemsTab;
    await tab.click();
  }

  getActionItemSearchInput(): Locator {
    return this.page.getByPlaceholder(/Search action items/i);
  }
}
