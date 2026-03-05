import { test, expect } from './fixtures/test-fixtures';

test.describe('Organization Management', () => {
  test('should create a new organization successfully', async ({
    createOrgPage,
    page,
    auth,
  }) => {
    const orgName = `E2E Org ${Date.now()}`;
    const orgSlug = `e2e-org-${Date.now()}`;

    await createOrgPage.goto();
    await createOrgPage.createOrganization(orgName, orgSlug);

    // Should redirect to chat page after success
    await page.waitForURL('**/chat', { timeout: 10000 });
    expect(page.url()).toContain('/chat');

    // Verify organization is selected in sidebar (optional check)
    // Using .first() because there might be multiple navigation elements (e.g., mobile/desktop)
    // We expect the organization name to appear in the active organization button
    await expect(page.getByRole('navigation').first()).toContainText(orgName);
    await expect(page.getByRole('button', { name: orgName })).toBeVisible();
  });

  test('should auto-generate slug from organization name', async ({
    createOrgPage,
    auth,
  }) => {
    await createOrgPage.goto();
    await createOrgPage.nameInput.fill('My New Corp');

    // Wait for slug to be generated
    await expect(createOrgPage.slugInput).toHaveValue('my-new-corp');
  });

  test('should show error when slug is already taken', async ({
    createOrgPage,
    page,
    auth,
  }) => {
    // First, let's try to create an organization with a fixed slug
    const orgName = 'Test Org';
    const fixedSlug = `fixed-slug-${Date.now()}`;

    await createOrgPage.goto();
    await createOrgPage.createOrganization(orgName, fixedSlug);

    // Wait for success and redirect
    await page.waitForURL('**/chat', { timeout: 10000 });

    // Now try to create another one with the same slug
    await createOrgPage.goto();
    await createOrgPage.createOrganization('Another Org', fixedSlug);

    // Should show error message
    // It might be a field-level error or a root error
    await expect(
      createOrgPage.errorMessage.or(page.locator('form p')),
    ).toBeVisible();
    await expect(
      createOrgPage.errorMessage.or(page.locator('form p')),
    ).toContainText(/already taken|overlap|already exists/i);
  });
});
