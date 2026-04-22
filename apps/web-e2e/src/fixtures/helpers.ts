import { Browser } from "@playwright/test";
import { CompaniesPage } from "../pages/CompaniesPage";
import { ContactsPage } from "../pages/ContactsPage";
import { DealsPage } from "../pages/DealsPage";
import { TasksPage } from "../pages/TasksPage";

export async function createFreshCompany(browser: Browser): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const companiesPage = new CompaniesPage(page);
  await companiesPage.goto();
  const newCompanyIndex = await companiesPage.createNewCompany();
  const newRow = page.getByRole("row").nth(newCompanyIndex);
  await companiesPage.clickCompany(newRow);
  const companyId = await companiesPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return companyId;
}

export async function createFreshContact(browser: Browser): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const contactsPage = new ContactsPage(page);
  await contactsPage.goto();
  const newContactIndex = await contactsPage.createNewContact();
  const newRow = page.getByRole("row").nth(newContactIndex);
  await contactsPage.clickContact(newRow);
  const contactId = await contactsPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return contactId;
}

export async function createFreshDeal(browser: Browser): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const dealsPage = new DealsPage(page);
  await dealsPage.goto();
  const newDealIndex = await dealsPage.createNewDeal();
  const newRow = page.getByRole("row").nth(newDealIndex);
  await dealsPage.clickDeal(newRow);
  const dealId = await dealsPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return dealId;
}

export async function createFreshTask(browser: Browser): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const tasksPage = new TasksPage(page);
  await tasksPage.goto();
  const newTaskIndex = await tasksPage.createNewTask();
  const newRow = page.getByRole("row").nth(newTaskIndex);
  await tasksPage.clickTask(newRow);
  const taskId = await tasksPage.waitForDetailsPageToLoad();
  await page.close();
  await context.close();
  return taskId;
}
