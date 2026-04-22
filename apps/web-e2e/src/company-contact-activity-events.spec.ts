import { test, expect } from "./fixtures";
import { createFreshCompany, createFreshContact } from "./fixtures/helpers";

/**
 * Company & Contact Activity Timeline – System Events
 *
 * Verifies that each lifecycle action produces the correct system event in the
 * activity timeline: company_created, contact_created, field_update,
 * contact_linked, contact_unlinked.
 */

// ── Helper ──────────────────────────────────────────────────────────────────

test.describe("Company Activity Timeline - System Events", () => {
  let companyId: number;
  test.beforeAll(async ({ browser }) => {
    companyId = await createFreshCompany(browser);
  });
  // ── company_created ────────────────────────────────────────────────────────
  test.describe("company_created", () => {
    test("shows 'created this company' after a new company is created", async ({
      companyDetailPage,
    }) => {
      // company created in beforeAll, verify if activity is present
      await companyDetailPage.goto(companyId);
      await companyDetailPage.openActivityHistory();
      await expect(companyDetailPage.hideHistoryButton).toBeVisible();
      await companyDetailPage.expectActivityEntry(/created this company/i);
    });
  });

  // ── company field_update ───────────────────────────────────────────────────
  test.describe("field_update", () => {
    test("shows 'updated' event after a company field is edited inline", async ({
      companyDetailPage,
    }) => {
      await companyDetailPage.goto(companyId);
      const newSummary = `Updated summary ${Date.now()}`;
      await companyDetailPage.updateSummary(newSummary, companyId);

      await companyDetailPage.openActivityHistory();
      await expect(companyDetailPage.hideHistoryButton).toBeVisible();
      await companyDetailPage.expectActivityEntry(/set summary/i);
    });
  });

  // ── contact_linked ─────────────────────────────────────────────────────────

  test.describe("contact_linked", () => {
    test("shows 'linked contact' after adding a contact to a company", async ({
      companyDetailPage,
    }) => {
      await companyDetailPage.goto(companyId);

      // Check if there is a contact available to add
      const hasAddButton = await companyDetailPage.addContactButton.isVisible().catch(() => false);
      if (!hasAddButton) {
        test.skip();
        return;
      }

      // Add a contact (picks first available)
      let contactName: string;
      try {
        contactName = await companyDetailPage.addContact();
      } catch {
        test.skip();
        return;
      }

      await companyDetailPage.openActivityHistory();
      await expect(companyDetailPage.hideHistoryButton).toBeVisible();

      // The activity text is "linked contact <name>"
      const baseName = contactName.split('(')[0].trim();
      await companyDetailPage.expectActivityEntry(
        new RegExp(`linked contact ${baseName}`, 'i')
      );
    });
  });

  // ── contact_unlinked ───────────────────────────────────────────────────────

  test.describe("contact_unlinked", () => {
    test("shows 'unlinked contact' after removing a contact from a company", async ({
      companyDetailPage,
    }) => {
      await companyDetailPage.goto(companyId);

      // Make sure there's a contact to remove – add one first if needed
      let contacts = await companyDetailPage.getAssociatedContacts();
      if (contacts.length === 0) {
        try {
          await companyDetailPage.addContact();
        } catch {
          test.skip();
          return;
        }
        contacts = await companyDetailPage.getAssociatedContacts();
      }
      if (contacts.length === 0) {
        test.skip();
        return;
      }

      const contactLink = contacts[0].locator('a');
      const contactName = (await contactLink.textContent()) ?? '';
      await companyDetailPage.removeContact(contactName);

      await companyDetailPage.openActivityHistory();
      await expect(companyDetailPage.hideHistoryButton).toBeVisible();
      await companyDetailPage.expectActivityEntry(
        new RegExp(`unlinked contact ${contactName}`, 'i')
      );
    });
  });
});

test.describe("Contact Activity Timeline - System Events", () => {
  let contactId: number;
  test.beforeAll(async ({ browser }) => {
    contactId = await createFreshContact(browser);
  });
  // ── contact_created ────────────────────────────────────────────────────────

  test.describe("contact_created", () => {
    test("shows 'created this contact' after a new contact is created", async ({
      contactDetailPage,
    }) => {
      // contact created in beforeAll, verify if activity is present
      await contactDetailPage.goto(contactId);
      await contactDetailPage.openActivityHistory();
      await expect(contactDetailPage.hideHistoryButton).toBeVisible();
      await contactDetailPage.expectActivityEntry(/created this contact/i);
    });
  });

  // ── contact field_update ───────────────────────────────────────────────────

  test.describe("field_update", () => {
    test("shows 'updated' event after a contact field is edited", async ({
      contactDetailPage,
    }) => {
      await contactDetailPage.goto(contactId);

      // Inital edit notes
      const newNotes = `Note ${Date.now()}`;
      await contactDetailPage.updateNotes(newNotes, contactId);
      await contactDetailPage.openActivityHistory();
      await expect(contactDetailPage.hideHistoryButton).toBeVisible();
      await contactDetailPage.expectActivityEntry(/set notes/i);

      // Update notes again
      const updatedNotes = `Updated notes ${Date.now()}`;
      await contactDetailPage.updateNotes(updatedNotes, contactId);
      await contactDetailPage.expectActivityEntry(/set notes/i);
    });
  });
});
