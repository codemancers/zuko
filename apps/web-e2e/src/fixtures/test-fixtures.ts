import { test as base } from '@playwright/test';
import {
  SignInPage,
  ContactsPage,
  ContactDetailPage,
  CompaniesPage,
  CompanyDetailPage,
  DealsPage,
  DealDetailPage,
  SettingsPage,
  ChatPage,
  CreateOrgPage,
  TeamsPage,
  MeetingsPage,
  MeetingDetailPage,
  TasksPage,
  TaskDetailPage,
  TablePage,
} from '../pages';
import { createUserWithSession, AuthUser } from '../lib/auth';

type TestFixtures = {
  tasksPage: TasksPage;
  taskDetailPage: TaskDetailPage;
  tablePage: TablePage;
  signInPage: SignInPage;
  contactsPage: ContactsPage;
  contactDetailPage: ContactDetailPage;
  companiesPage: CompaniesPage;
  companyDetailPage: CompanyDetailPage;
  dealsPage: DealsPage;
  dealDetailPage: DealDetailPage;
  settingsPage: SettingsPage;
  chatPage: ChatPage;
  createOrgPage: CreateOrgPage;
  teamsPage: TeamsPage;
  meetingsPage: MeetingsPage;
  meetingDetailPage: MeetingDetailPage;
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
  tasksPage: async ({ page }, use) => {
    await use(new TasksPage(page));
  },
  taskDetailPage: async ({ page }, use) => {
    await use(new TaskDetailPage(page));
  },
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  contactsPage: async ({ page }, use) => {
    await use(new ContactsPage(page));
  },
  contactDetailPage: async ({ page }, use) => {
    await use(new ContactDetailPage(page));
  },
  companiesPage: async ({ page }, use) => {
    await use(new CompaniesPage(page));
  },
  companyDetailPage: async ({ page }, use) => {
    await use(new CompanyDetailPage(page));
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
  createOrgPage: async ({ page }, use) => {
    await use(new CreateOrgPage(page));
  },
  teamsPage: async ({ page }, use) => {
    await use(new TeamsPage(page));
  },
  meetingsPage: async ({ page }, use) => {
    await use(new MeetingsPage(page));
  },
  meetingDetailPage: async ({ page }, use) => {
    await use(new MeetingDetailPage(page));
  },

  tablePage: async ({ page }, use) => {
    await use(new TablePage(page));
  },

  // ── Auth fixture ──────────────────────────────────────────────────────────
  auth: async ({ page }, use) => {
    const { user, cookies, cleanup } = await createUserWithSession();

    // Inject properly-signed session cookies into this page context
    await page.context().addCookies(cookies);

    await use(user);

    await cleanup();
  },
});

export { expect } from '@playwright/test';
