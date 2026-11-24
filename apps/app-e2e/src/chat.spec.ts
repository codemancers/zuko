import { expect, test } from '@playwright/test';
import { APP_URL } from './support/env';

const password = 'e2e-test-password-123';

test('an organization member can open the Eve-powered Zuko copilot', async ({ page, request }) => {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-chat-${run}@example.com`;

  await page.goto('/signup');
  await page.getByLabel('Name').fill('Chat Owner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();

  await page.getByLabel('Organization name').fill('Copilot Test Org');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'New chat' }).click();
  await expect(page).toHaveURL(/\/chat\/new$/);
  await expect(page.getByRole('heading', { name: 'Zuko copilot' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Copilot Test Org')).toBeVisible();
  await expect(page.getByText('What can I help with?')).toBeVisible();
  await expect(page.getByLabel('Message Zuko copilot')).toBeEnabled();
  await expect(page.getByText('Changes require your approval')).toBeVisible();

  await page.getByRole('link', { name: 'Your chats' }).click();
  await expect(page).toHaveURL(/\/chat\/history$/);
  await expect(page.getByRole('heading', { name: 'Your chats' })).toBeVisible();

  const health = await request.get(`${APP_URL}/eve/v1/health`);
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ ok: true, status: 'ready' });
});
