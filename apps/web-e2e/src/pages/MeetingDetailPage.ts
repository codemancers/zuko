import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

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
    this.backButton = page.getByRole('button', { name: /meetings/i });
    this.meetingHeading = page.getByRole('heading', { level: 1 });
    this.recordingTab = page.getByRole('tab', { name: /recording/i });
    this.transcriptTab = page.getByRole('tab', { name: /transcript/i });
    this.chatTab = page.getByRole('tab', { name: /^chat$/i });
    this.summaryTab = page.getByRole('tab', { name: /summary/i });
    this.actionItemsTab = page.getByRole('tab', { name: /action items/i });
  }

  override async goto(id: string) {
    await super.goto(`/meeting/${id}`);
  }

  async clickTab(
    name: 'Recording' | 'Transcript' | 'Chat' | 'Summary' | 'Action Items',
  ) {
    const tab =
      name === 'Recording'
        ? this.recordingTab
        : name === 'Transcript'
          ? this.transcriptTab
          : name === 'Chat'
            ? this.chatTab
            : name === 'Summary'
              ? this.summaryTab
              : this.actionItemsTab;
    await tab.click();
  }

  getActionItemSearchInput(): Locator {
    return this.page.getByPlaceholder(/Search action items/i);
  }
}
