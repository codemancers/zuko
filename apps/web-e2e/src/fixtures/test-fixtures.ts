import { test as base, Page } from '@playwright/test';
import {
  SignInPage,
  ContactsPage,
  ContactDetailPage,
  AccountsPage,
  AccountDetailPage,
  DealsPage,
  DealDetailPage,
  SettingsPage,
  ChatPage,
} from '../pages';
import { createUserWithSession, AuthUser } from '../lib/auth';

type TestFixtures = {
  signInPage: SignInPage;
  contactsPage: ContactsPage;
  contactDetailPage: ContactDetailPage;
  accountsPage: AccountsPage;
  accountDetailPage: AccountDetailPage;
  dealsPage: DealsPage;
  dealDetailPage: DealDetailPage;
  settingsPage: SettingsPage;
  chatPage: ChatPage;
  /**
   * Fixture that creates a fresh test user, injects signed session cookies into
   * the page context, and cleans up the user after the test.
   *
   * Usage: add `auth` to your test parameters and all page navigations in that
   * test will be authenticated automatically.
   *
   * @example
   * test('can view contacts', async ({ contactsPage, auth }) => {
   *   await contactsPage.goto(); // authenticated
   *   expect(auth.id).toBeGreaterThan(0);
   * });
   */
  auth: AuthUser;
};

export const test = base.extend<TestFixtures>({
  // ── Page Object fixtures ──────────────────────────────────────────────────
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  contactsPage: async ({ page }, use) => {
    await use(new ContactsPage(page));
  },
  contactDetailPage: async ({ page }, use) => {
    await use(new ContactDetailPage(page));
  },
  accountsPage: async ({ page }, use) => {
    await use(new AccountsPage(page));
  },
  accountDetailPage: async ({ page }, use) => {
    await use(new AccountDetailPage(page));
  },
  dealsPage: async ({ page }, use) => {
    await use(new DealsPage(page));
  },
  dealDetailPage: async ({ page }, use) => {
    await use(new DealDetailPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },

  // ── Auth fixture ──────────────────────────────────────────────────────────
  auth: async ({ page }, use) => {
    const { user, cookies, cleanup } = await createUserWithSession();

    // Inject properly-signed session cookies into this test's page context
    await page.context().addCookies(cookies);

    await use(user);

    await cleanup();
  },
});

export { expect } from '@playwright/test';
