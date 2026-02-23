import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Account Detail page
 */
export class AccountDetailPage extends BasePage {
  readonly editButton: Locator;
  readonly hideButton: Locator;
  readonly addContactButton: Locator;
  readonly associatedContactsSection: Locator;

  constructor(page: Page) {
    super(page);
    // Use exact match to avoid matching "Edit association" button
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.hideButton = page.getByRole('button', { name: /Hide/i });
    this.addContactButton = page.getByRole('button', { name: 'Add Contact' });
    this.associatedContactsSection = page.locator('text=Associated Contacts').locator('..');
  }

  /**
   * Navigate to a specific account detail page
   */
  async goto(accountId: number) {
    await super.goto(`/accounts/${accountId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click edit button
   */
  async clickEdit() {
    await this.editButton.click();
  }

  /**
   * Add a contact to the account
   */
  async addContact(contactName: string, role?: string, isPrimary = false) {
    // Click Add Contact button
    await this.addContactButton.click();

    // Wait for dialog to open
    await this.page.waitForSelector('text=Add Contact to Account');

    // Select contact from dropdown
    const selectContact = this.page.locator('select').first();
    await selectContact.selectOption({ label: new RegExp(contactName, 'i') });

    // Fill role if provided
    if (role) {
      const roleInput = this.page.getByPlaceholder(/e.g., Employee, Contractor/i);
      await roleInput.fill(role);
    }

    // Check primary if requested
    if (isPrimary) {
      const primaryCheckbox = this.page.getByText(/Primary contact for this account/i).locator('xpath=preceding-sibling::input[@type="checkbox"]');
      await primaryCheckbox.check();
    }

    // Click submit button
    await this.page.getByRole('button', { name: /Add Contact/i }).click();

    // Wait for dialog to close and data to refresh
    await this.page.waitForSelector('text=Add Contact to Account', { state: 'hidden', timeout: 3000 });
  }

  /**
   * Remove a contact from the account
   */
  async removeContact(contactName: string) {
    // Find the contact row
    const contactRow = this.page.locator(`text=${contactName}`).locator('xpath=ancestor::div[contains(@class, "flex")]');

    // Click the remove (X) button
    const removeButton = contactRow.getByTitle('Remove contact');

    // Set up dialog handler and wait for API response
    this.page.once('dialog', dialog => dialog.accept());
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/') && (resp.status() === 200 || resp.status() === 204),
      { timeout: 5000 }
    );

    await removeButton.click();
    await responsePromise;

    // Wait for the contact row to be removed from DOM
    await contactRow.waitFor({ state: 'detached', timeout: 3000 });
  }

  /**
   * Edit a contact association inline
   */
  async editContactAssociation(contactName: string, newRole?: string, setPrimary?: boolean) {
    // Find the contact row
    const contactRow = this.page.locator(`text=${contactName}`).locator('xpath=ancestor::div[contains(@class, "flex")]');

    // Click the edit (pencil) button
    const editButton = contactRow.getByTitle('Edit association');
    await editButton.click();

    // Wait for edit mode - role input should appear
    const roleInput = contactRow.locator('input[type="text"]');
    await roleInput.waitFor({ state: 'visible', timeout: 3000 });

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
    const saveButton = contactRow.getByTitle('Save changes');
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/') && resp.ok(),
      { timeout: 5000 }
    );
    await saveButton.click();
    await responsePromise;

    // Wait for edit mode to close - save button should disappear
    await saveButton.waitFor({ state: 'detached', timeout: 3000 });
  }

  /**
   * Get list of associated contacts
   */
  async getAssociatedContacts() {
    const contacts = await this.page.locator('text=Associated Contacts')
      .locator('..')
      .locator('div.space-y-3 > div')
      .all();
    return contacts;
  }

  /**
   * Check if a contact is associated
   */
  async isContactAssociated(contactName: string): Promise<boolean> {
    const contactElement = this.page.locator(`text=${contactName}`).first();
    return await contactElement.isVisible().catch(() => false);
  }

  /**
   * Get the role badge text for a contact
   */
  async getContactRole(contactName: string): Promise<string | null> {
    const contactRow = this.page.locator(`text=${contactName}`).locator('xpath=ancestor::div[contains(@class, "flex")]');
    const roleBadge = contactRow.locator('[class*="Badge"]').first();
    return await roleBadge.textContent().catch(() => null);
  }

  /**
   * Check if contact is marked as primary
   */
  async isContactPrimary(contactName: string): Promise<boolean> {
    const contactRow = this.page.locator(`text=${contactName}`).locator('xpath=ancestor::div[contains(@class, "flex")]');
    const primaryBadge = contactRow.locator('text=Primary');
    return await primaryBadge.isVisible().catch(() => false);
  }

  /**
   * Post a comment on the activity timeline
   */
  async postComment(comment: string) {
    const textarea = this.page.getByPlaceholder('Add a comment...');
    await textarea.fill(comment);

    // Wait for API response when posting comment
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/activities') && resp.ok(),
      { timeout: 10000 }
    );
    await this.page.getByRole('button', { name: 'Post Comment' }).click();
    await responsePromise;

    // Wait for textarea to be cleared (indicating successful post)
    await textarea.waitFor({ state: 'visible', timeout: 3000 });
    await this.page.waitForFunction(
      (el) => (el as HTMLTextAreaElement).value === '',
      textarea
    );
  }

  /**
   * Get all activity items
   */
  async getActivityItems() {
    return this.page.locator('[data-testid="activity-item"]').all();
  }
}
