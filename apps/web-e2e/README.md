# E2E Tests for Zuko Web App

This directory contains end-to-end (e2e) tests for the Zuko web application using Playwright and Nx.

## Overview

The test suite follows Nx best practices and implements the Page Object Model pattern for maintainable and scalable tests.

## Project Structure

```
apps/web-e2e/
├── src/
│   ├── fixtures/          # Test fixtures and utilities
│   │   ├── test-fixtures.ts    # Custom test fixtures with page objects
│   │   ├── test-data.ts        # Test data and generators
│   │   └── index.ts
│   ├── pages/            # Page Object Models
│   │   ├── BasePage.ts        # Base page with common methods
│   │   ├── SignInPage.ts      # Sign-in page
│   │   ├── ContactsPage.ts    # Contacts page
│   │   ├── SettingsPage.ts    # Settings page
│   │   ├── ChatPage.ts        # Chat page
│   │   └── index.ts
│   ├── example.spec.ts   # Homepage/navigation tests
│   ├── auth.spec.ts      # Authentication tests
│   ├── contacts.spec.ts  # Contacts feature tests
│   └── settings.spec.ts  # Settings feature tests
├── playwright.config.ts   # Playwright configuration
└── README.md

## Running Tests

### Run all tests
```bash
npx nx e2e web-e2e
```

### Run tests in UI mode (watch mode)
```bash
npx nx e2e web-e2e --ui
```

### Run specific test file
```bash
npx nx e2e web-e2e -- src/auth.spec.ts
```

### Run tests in a specific browser
```bash
# Chromium (default)
npx nx e2e web-e2e -- --project=chromium

# Firefox
npx nx e2e web-e2e -- --project=firefox

# WebKit (Safari)
npx nx e2e web-e2e -- --project=webkit
```

### Run tests in headed mode (see browser)
```bash
npx nx e2e web-e2e -- --headed
```

### Debug tests
```bash
npx nx e2e web-e2e -- --debug
```

### Run tests in CI mode
```bash
npx nx e2e-ci web-e2e
```

## Test Reports

After running tests, reports are generated in:
- HTML Report: `apps/web-e2e/test-output/playwright/report/index.html`
- JSON Report: `apps/web-e2e/test-output/playwright/results.json`
- JUnit Report: `apps/web-e2e/test-output/playwright/results.xml`

Open HTML report:
```bash
npx playwright show-report apps/web-e2e/test-output/playwright/report
```

## Page Object Model

Tests use the Page Object Model (POM) pattern for better maintainability:

```typescript
import { test, expect } from './fixtures';

test('example test with page objects', async ({ signInPage }) => {
  await signInPage.goto();
  await signInPage.verifyPageLoaded();
  await signInPage.clickGitHubSignIn();
});
```

### Available Page Objects

- `BasePage` - Common functionality for all pages
- `SignInPage` - Sign-in page interactions
- `ContactsPage` - Contacts list and management
- `SettingsPage` - Settings and configuration
- `ChatPage` - Chat interface

## Test Fixtures

Custom fixtures provide pre-configured page objects:

```typescript
import { test, expect } from './fixtures';

test('my test', async ({ signInPage, contactsPage, page }) => {
  // Use page objects directly
  await signInPage.goto();
  await contactsPage.goto();
});
```

## Test Data

Test data helpers are available in `fixtures/test-data.ts`:

```typescript
import { TEST_CONTACTS, generateUniqueTestData } from './fixtures';

// Use predefined test data
const contact = TEST_CONTACTS.validContact;

// Generate unique test data with timestamp
const uniqueContact = generateUniqueTestData(TEST_CONTACTS.validContact);
```

## Configuration

### Environment Variables

- `BASE_URL` - Base URL for the application (default: `http://localhost:3000`)
- `CI` - Set to `true` for CI environment (enables retries, serial execution)

### Playwright Configuration

Key settings in `playwright.config.ts`:

- **Browsers**: Chromium, Firefox, WebKit
- **Timeout**: 60s per test
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: On failure only
- **Video**: Retained on failure
- **Traces**: On first retry
- **Web Server**: Automatically starts dev server before tests

## Authentication

The test suite includes authentication setup using Playwright's `storageState` feature. Authentication is handled automatically via global setup.

### How It Works

1. **Global Setup** (`src/global-setup.ts`): Runs once before all tests to authenticate
2. **Auth State Storage**: Saves authentication cookies/session to `.auth/user.json`
3. **Authenticated Tests**: Use `authenticatedTest` fixture to load the saved state

### Setup Authentication

You have two options for authentication:

#### Option 1: API Authentication (Recommended)

Create a test API endpoint that logs in a test user:

```typescript
// In your backend (e.g., /api/auth/test-login)
// This endpoint should only be available in test environments
export async function testLogin(email, password) {
  // Authenticate and return session cookie
}
```

Then update `src/global-setup.ts`:

```typescript
async function authenticateViaAPI(page: any, baseURL: string) {
  const response = await page.request.post(`${baseURL}/api/auth/test-login`, {
    data: {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'test-password',
    },
  });

  await page.goto(baseURL);
}
```

#### Option 2: OAuth Flow (More Complex)

For GitHub OAuth, you need test credentials:

```bash
# Set environment variables
export GITHUB_TEST_USERNAME="your-test-account"
export GITHUB_TEST_PASSWORD="your-test-password"
```

The global setup will handle the OAuth flow automatically.

### Using Authenticated Tests

Use the `authenticatedTest` fixture for tests that require authentication:

```typescript
import { test, expect, authenticatedTest } from './fixtures';

// Regular test (no auth)
test('public page test', async ({ page }) => {
  await page.goto('/');
});

// Authenticated test (uses stored auth state)
authenticatedTest('authenticated feature', async ({ page, contactsPage }) => {
  await contactsPage.goto();
  // Now authenticated - can access protected pages
});
```

### Environment Variables

Set these environment variables for authentication:

```bash
# For API authentication
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test-password

# For OAuth authentication
GITHUB_TEST_USERNAME=your-test-account
GITHUB_TEST_PASSWORD=your-test-password
```

### Troubleshooting Authentication

If authentication fails:

1. **Check auth state file exists**: `apps/web-e2e/.auth/user.json`
2. **Run setup manually**: `npx playwright test --project=setup`
3. **Check environment variables** are set correctly
4. **Verify test endpoint** is accessible and working
5. **Check logs** during global setup for errors

The global setup will warn you if authentication fails, but tests will continue (and may skip if auth is required).

## Best Practices

1. **Use Page Objects** - Encapsulate page interactions in page objects
2. **Use Fixtures** - Leverage custom fixtures for common setup
3. **Descriptive Test Names** - Use clear, descriptive test names
4. **Wait for Elements** - Always wait for elements before interacting
5. **Avoid Hard Waits** - Use `waitFor` instead of `waitForTimeout`
6. **Test Independence** - Tests should be independent and not rely on order
7. **Clean Up** - Clean up test data after tests (when applicable)

## CI/CD Integration

For CI/CD pipelines:

```bash
# Run all e2e tests with CI optimizations
npx nx e2e-ci web-e2e

# Run with specific configuration
CI=true npx nx e2e web-e2e
```

CI mode enables:
- 2 retries per test
- Serial execution (1 worker)
- Strict mode (no test.only)
- Full reports

## Troubleshooting

### Tests are slow
- Run with `--workers=N` to use multiple workers
- Use `--project=chromium` to run on single browser
- Check if dev server is slow to start

### Tests are flaky
- Increase timeouts in `playwright.config.ts`
- Add proper wait conditions
- Check for race conditions

### Can't find elements
- Use Playwright Inspector: `npx nx e2e web-e2e -- --debug`
- Check selectors in page objects
- Verify element is visible before interaction

### Authentication issues
- Implement proper authentication setup
- Use `storageState` for persistent sessions
- Mock OAuth flow in tests

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Nx Playwright Documentation](https://nx.dev/packages/playwright)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)

## Contributing

When adding new tests:

1. Create page objects in `src/pages/`
2. Add test data to `src/fixtures/test-data.ts`
3. Write tests following existing patterns
4. Update this README if needed
5. Ensure tests pass locally before committing
