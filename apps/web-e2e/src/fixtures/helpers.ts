import { Browser } from '@playwright/test';
import path from 'path';
import { CompaniesPage } from '../pages/CompaniesPage';
import { ContactsPage } from '../pages/ContactsPage';
import { DealsPage } from '../pages/DealsPage';
import { TasksPage } from '../pages/TasksPage';

const AUTH_STORAGE_STATE = path.join(__dirname, '../../.auth/user.json');

export async function createFreshCompany(browser: Browser): Promise<number> {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
  });
  const page = await context.newPage();
  const companiesPage = new CompaniesPage(page);
  await companiesPage.goto();
  const companyName = await companiesPage.createNewCompany(
    `Fresh Company ${Date.now()}`,
  );
  const newRow = page.getByRole('row').filter({ hasText: companyName }).first();
  await companiesPage.clickCompany(newRow);
  const companyId = await companiesPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return companyId;
}

export async function createFreshContact(browser: Browser): Promise<number> {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
  });
  const page = await context.newPage();
  const contactsPage = new ContactsPage(page);
  await contactsPage.goto();
  const contactName = await contactsPage.createNewContact(
    `Fresh Contact ${Date.now()}`,
  );
  const newRow = page.getByRole('row').filter({ hasText: contactName }).first();
  await contactsPage.clickContact(newRow);
  const contactId = await contactsPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return contactId;
}

export async function createFreshDeal(browser: Browser): Promise<number> {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
  });
  const page = await context.newPage();
  const dealsPage = new DealsPage(page);
  await dealsPage.goto();
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/deals') &&
      resp.request().method() === 'POST' &&
      resp.ok(),
    { timeout: 15000 },
  );
  await dealsPage.createNewDeal(`Fresh Deal ${Date.now()}`);
  const response = await responsePromise;
  const createdDeal = await response.json();
  await page.close();
  await context.close();
  return createdDeal.id;
}

export async function createFreshTask(browser: Browser): Promise<number> {
  const context = await browser.newContext({
    storageState: AUTH_STORAGE_STATE,
  });
  const page = await context.newPage();
  const tasksPage = new TasksPage(page);
  await tasksPage.goto();
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/tasks') &&
      resp.request().method() === 'POST' &&
      resp.ok(),
    { timeout: 15000 },
  );
  await tasksPage.createNewTask(`Fresh Task ${Date.now()}`);
  const response = await responsePromise;
  const createdTask = await response.json();
  await page.close();
  await context.close();
  return createdTask.id;
}
