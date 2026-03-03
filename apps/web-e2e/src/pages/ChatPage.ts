import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Chat page
 */
export class ChatPage extends BasePage {
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly messagesContainer: Locator;

  constructor(page: Page) {
    super(page);
    // These selectors might need adjustment based on actual implementation
    this.chatInput = page.getByRole("textbox").or(page.locator("textarea"));
    this.sendButton = page
      .getByRole("button", { name: /send/i })
      .or(page.locator('button[type="submit"]'));
    this.messagesContainer = page
      .locator('[data-testid="messages"]')
      .or(page.locator("main"));
  }

  /**
   * Navigate to the chat page
   */
  override async goto() {
    await super.goto("/chat");
  }

  /**
   * Send a message in chat
   */
  async sendMessage(message: string) {
    await this.chatInput.fill(message);
    await this.sendButton.click();
  }

  /**
   * Get all messages
   */
  async getMessages() {
    // Adjust selector based on actual implementation
    return this.page
      .locator('[data-testid="message"]')
      .or(
        this.page.locator(".message").or(this.page.locator('[role="article"]')),
      )
      .all();
  }

  /**
   * Wait for a message to appear
   */
  async waitForMessage(text: string, options?: { timeout?: number }) {
    await this.page.getByText(text, { exact: false }).waitFor(options);
  }
}
