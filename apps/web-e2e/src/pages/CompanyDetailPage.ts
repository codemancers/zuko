import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Company Detail page
 */
export class CompanyDetailPage extends BasePage {
  readonly hideButton: Locator;
  readonly addContactButton: Locator;
  readonly associatedContactsSection: Locator;
  readonly hideHistoryButton: Locator;

  constructor(page: Page) {
    super(page);
    // Use exact match to avoid matching "Edit association" button
    this.hideButton = page.getByRole("button", { name: /Hide/i });
    this.addContactButton = page.getByRole("button", { name: "Add Contact" });
    this.associatedContactsSection = page
      .locator("text=Associated Contacts")
      .locator("..");
    this.companyName = page.locator('h1[contenteditable="true"]');
    this.summaryField = page.locator('#company-summary-editor .ce-paragraph[contenteditable="true"]').first();
    this.websiteField = page.getByPlaceholder(/https:\/\/example.com/i);
    this.linkedinUrlField = page.getByPlaceholder(/https:\/\/linkedin.com\/company\/example/i);
    this.hideHistoryButton = page.getByRole("button", { name: /Hide history/i });
  }

  readonly companyName: Locator;
  readonly summaryField: Locator;
  readonly websiteField: Locator;
  readonly linkedinUrlField: Locator;

  /**
   * Navigate to a specific company detail page
   */
  // @ts-expect-error: intentionally overloading goto with a numeric id
  async goto(companyId: number) {
    await super.goto(`/companies/${companyId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Update a company property inline and wait for the PATCH response.
   */
  async updateProperty(label: string, value: string, companyId: number) {
    await this.updateEntityProperty(label, value, `/companies/${companyId}`);
  }

  /**
   * Update the company name (h1 contenteditable) inline and wait for save.
   */
  async updateCompanyName(name: string, companyId: number) {
    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(`/companies/${companyId}`) &&
        resp.request().method() === "PATCH",
      { timeout: 10000 },
    );
    await this.updateTitle(name);
    await patchPromise;
  }

  /**
   * Update the summary textarea and wait for save.
   */
  async updateSummary(summary: string, companyId: number) {
    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(`/companies/${companyId}`) &&
        resp.request().method() === "PATCH",
      { timeout: 10000 },
    );
    await this.summaryField.waitFor({ state: 'visible' });
    await this.summaryField.click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(summary);
    await this.summaryField.blur();
    await patchPromise;
  }

  /**
   * Add a contact to the company.
   * If contactName is provided and found in the dropdown, selects it; otherwise selects the first available contact.
   * @returns The display name of the selected contact (e.g. for assertions)
   */
  async addContact(
    contactName?: string,
    role?: string,
    isPrimary = false
  ): Promise<string> {
    await this.addContactButton.click();

    await this.page.waitForSelector("text=Add Contact to Company");

    const selectContact = this.page.locator("select").first();
    // Wait for dropdown to be populated (contacts query may be async)
    await selectContact
      .locator('option[value]:not([value=""])')
      .first()
      .waitFor({ state: "attached", timeout: 10000 })
      .catch(() => {
        throw new Error(
          "No contacts available in dropdown (all may already be associated with this company)"
        );
      });

    const options = await selectContact.locator("option").all();
    const optionValues = await Promise.all(
      options.map((o) => o.getAttribute("value"))
    );
    const optionTexts = await Promise.all(
      options.map((o) => o.textContent().then((t) => t?.trim() ?? ""))
    );

    const firstRealIndex = optionValues.findIndex((v) => v && v !== "");
    if (firstRealIndex === -1) {
      throw new Error("No contacts available in dropdown");
    }

    let selectedName: string;
    if (contactName) {
      const matchIndex = optionTexts.findIndex((t) =>
        t.toLowerCase().includes(contactName.toLowerCase())
      );
      if (matchIndex !== -1) {
        await selectContact.selectOption({ index: matchIndex });
        selectedName = optionTexts[matchIndex];
      } else {
        await selectContact.selectOption({ index: firstRealIndex });
        selectedName = optionTexts[firstRealIndex];
      }
    } else {
      await selectContact.selectOption({ index: firstRealIndex });
      selectedName = optionTexts[firstRealIndex];
    }

    if (role) {
      const roleInput = this.page.getByPlaceholder(
        /e.g., Employee, Contractor/i
      );
      await roleInput.fill(role);
    }

    if (isPrimary) {
      const primaryCheckbox = this.page
        .getByText(/Primary contact for this company/i)
        .locator('xpath=preceding-sibling::input[@type="checkbox"]');
      await primaryCheckbox.check();
    }

    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Add Contact/i }).click();

    await dialog.waitFor({ state: "hidden", timeout: 15000 });

    return selectedName;
  }

  /**
   * Remove a contact from the company.
   * Scopes to the Associated Contacts section to avoid matching other page content.
   */
  async removeContact(contactName: string) {
    const section = this.page
      .getByRole("heading", { name: "Associated Contacts" })
      .locator("..")
      .locator("..");
    let contactRow = section
      .locator("div.flex")
      .filter({ has: this.page.getByTitle("Remove contact") });
    if (contactName) {
      contactRow = contactRow.filter({
        has: this.page.getByRole("link", {
          name: new RegExp(
            contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          ),
        }),
      });
    }
    contactRow = contactRow.first();

    const removeButton = contactRow.getByTitle("Remove contact");
    await removeButton.click();

    // ConfirmDialog appears — click the "Remove" confirm button
    const confirmButton = this.page.getByRole("button", { name: /^Remove$/ });
    await confirmButton.waitFor({ state: "visible", timeout: 5000 });
    await confirmButton.click();
    // Dialog doesn't auto-close after mutation (onSuccess doesn't reset state)
    // Press Escape to dismiss so page content is no longer aria-hidden
    await this.page.keyboard.press("Escape");

    await contactRow.waitFor({ state: "detached", timeout: 10000 });
  }

  /**
   * Edit a contact association inline.
   * Scopes to the Associated Contacts section.
   */
  async editContactAssociation(
    contactName: string,
    newRole?: string,
    setPrimary?: boolean
  ) {
    const section = this.page
      .getByRole("heading", { name: "Associated Contacts" })
      .locator("..")
      .locator("..");
    const contactRow = section
      .locator("div.flex")
      .filter({
        has: this.page.getByRole("link", {
          name: new RegExp(
            contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          ),
        }),
      })
      .first();

    const editButton = contactRow.getByTitle("Edit association");
    await editButton.click();

    // Wait for edit mode - role input should appear
    const roleInput = contactRow.locator('input[type="text"]');
    await roleInput.waitFor({ state: "visible", timeout: 3000 });

    // Edit role if provided
    if (newRole !== undefined) {
      await roleInput.clear();
      await roleInput.fill(newRole);
    }

    // Toggle primary if specified
    if (setPrimary !== undefined) {
      const primaryCheckbox = contactRow.locator('input[type="checkbox"]');
      const isChecked = await primaryCheckbox.isChecked();
      if (isChecked !== setPrimary) {
        await primaryCheckbox.click();
      }
    }

    // Click save (checkmark) button and wait for API response
    const saveButton = contactRow.getByTitle("Save changes");
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/") && resp.ok(),
      { timeout: 5000 }
    );
    await saveButton.click();
    await responsePromise;

    // Wait for edit mode to close - save button should disappear
    await saveButton.waitFor({ state: "detached", timeout: 3000 });
  }

  /**
   * Get list of associated contact rows (only rows that contain a contact link).
   * Use this to avoid matching loading/empty placeholders.
   */
  async getAssociatedContacts(): Promise<Locator[]> {
    const section = this.page
      .getByRole("heading", { name: "Associated Contacts" })
      .locator("..")
      .locator("..");
    return section
      .locator("div.space-y-3 > div")
      .filter({ has: this.page.locator('a[href^="/contacts/"]') })
      .all();
  }

  /**
   * Check if a contact is associated.
   * Scoped to the Associated Contacts section to avoid matching timeline text.
   */
  async isContactAssociated(contactName: string): Promise<boolean> {
    const section = this.page
      .getByRole("heading", { name: "Associated Contacts" })
      .locator("..")
      .locator("..");
    const contactElement = section
      .locator('a[href^="/contacts/"]')
      .filter({ hasText: contactName })
      .first();
    return await contactElement.isVisible().catch(() => false);
  }

  /**
   * Get the role badge text for a contact
   */
  async getContactRole(contactName: string): Promise<string | null> {
    const contactRow = this.page
      .locator(`text=${contactName}`)
      .locator('xpath=ancestor::div[contains(@class, "flex")]');
    const roleBadge = contactRow.locator('[class*="Badge"]').first();
    return await roleBadge.textContent().catch(() => null);
  }

  /**
   * Check if contact is marked as primary
   */
  async isContactPrimary(contactName: string): Promise<boolean> {
    const contactRow = this.page
      .locator(`text=${contactName}`)
      .locator('xpath=ancestor::div[contains(@class, "flex")]');
    const primaryBadge = contactRow.locator("text=Primary");
    return await primaryBadge.isVisible().catch(() => false);
  }

  /**
   * Post a comment on the activity timeline.
   * Waits for the comment to appear in the UI (resilient to API proxy path).
   */
  async postComment(comment: string) {
    const textarea = this.page.getByPlaceholder("Add a comment...");
    await textarea.fill(comment);
    await this.page.getByRole("button", { name: "Post Comment" }).click();

    // Wait for comment to appear in timeline
    await this.page
      .getByText(comment, { exact: false })
      .waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Get all activity items
   */
  async getActivityItems() {
    return this.page.locator('[data-testid="activity-item"]').all();
  }
}
