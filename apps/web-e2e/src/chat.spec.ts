import { test, expect } from './fixtures';

/**
 * Chat tests run with project storage state (logged-in user).
 * Unauthenticated describe overrides with empty storage state.
 */
test.describe('Chat - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });

  test('redirects to sign-in when accessing specific chat without auth', async ({
    page,
  }) => {
    await page.goto('/chat/1');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Chat', () => {
  let chatId: string;

  test.beforeEach(async ({ page }) => {
    const response = await page.request.post(
      'http://localhost:3001/api/chats',
      {
        data: {
          title: 'E2E Test Chat',
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    chatId = chat.id;
  });

  test.afterEach(async ({ page }) => {
    if (chatId) {
      await page.request
        .delete(`http://localhost:3001/api/chats/${chatId}`)
        .catch(() => {
          // ignore
        });
    }
  });

  test('chat page displays correctly with empty state', async ({ page }) => {
    await page.goto(`/chat/${chatId}`);

    // Verify we're on the correct chat page
    await expect(page).toHaveURL(`/chat/${chatId}`);

    // Verify empty state is shown
    await expect(page.getByText('Start a conversation')).toBeVisible();
    await expect(
      page.getByText('Ask me anything to get started'),
    ).toBeVisible();

    // Verify input is present
    const textarea = page.getByPlaceholder('Ask anything...');
    await expect(textarea).toBeVisible();
  });

  test('chatId is correctly passed in request body when sending message', async ({
    page,
  }) => {
    await page.goto(`/chat/${chatId}`);

    // Set up request interception to capture the API call
    let capturedRequestBody: any = null;

    page.on('request', (request) => {
      if (request.url().includes('/api/chat') && request.method() === 'POST') {
        capturedRequestBody = request.postDataJSON();
      }
    });

    // Type a message and send it
    const textarea = page.getByPlaceholder('Ask anything...');
    await textarea.fill('Hello, this is a test message');

    // Find and click the submit button - wait for API request
    const submitButton = page.locator('button[type="submit"]').last();
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/chat') && req.method() === 'POST',
      { timeout: 5000 },
    );
    await submitButton.click();
    await requestPromise;

    // Verify the request was made with messages
    // Note: chatId is NOT in the client request body - it's extracted server-side from the Referer header
    expect(capturedRequestBody).toBeTruthy();
    expect(capturedRequestBody.messages).toBeDefined();
    expect(capturedRequestBody.messages).toHaveLength(1);

    // AI SDK v6 uses parts array instead of content
    expect(capturedRequestBody.messages[0].parts).toBeDefined();
    expect(capturedRequestBody.messages[0].parts[0].text).toBe(
      'Hello, this is a test message',
    );
  });

  test('message is sent and response is displayed', async ({ page }) => {
    await page.goto(`/chat/${chatId}`);

    // Type and send a message
    const textarea = page.getByPlaceholder('Ask anything...');
    await textarea.fill('What is 2+2?');

    const submitButton = page.locator('button[type="submit"]').last();
    await submitButton.click();

    // Wait for the user message to appear
    await expect(page.getByText('What is 2+2?')).toBeVisible({ timeout: 5000 });

    // Wait for AI response to start appearing (streaming)
    // The response should appear within a reasonable time
    await page.waitForSelector('[data-slot="content"]', { timeout: 10000 });

    // Verify the empty state is no longer visible
    await expect(page.getByText('Start a conversation')).toBeHidden();
  });

  test('multiple messages can be sent in sequence', async ({ page }) => {
    await page.goto(`/chat/${chatId}`);

    const textarea = page.getByPlaceholder('Ask anything...');
    const submitButton = page.locator('button[type="submit"]').last();

    // Send first message
    await textarea.fill('First message');
    await submitButton.click();
    await expect(page.getByText('First message')).toBeVisible({
      timeout: 5000,
    });

    // Wait for first AI response before sending next message
    // [data-slot="content"] is the AI response container (same selector used in the passing test)
    await page.waitForSelector('[data-slot="content"]', { timeout: 15000 });

    // Send second message
    const textareaInChatPage = page.getByPlaceholder('Ask anything...');
    await textareaInChatPage.fill('Second message');
    await submitButton.click();

    // Scope to chat log so we match the rendered message, not the textarea or highlights
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Second message')).toBeVisible({
      timeout: 5000,
    });

    // Verify both user messages are in the conversation
    await expect(chatLog.getByText('First message')).toBeVisible();
    await expect(chatLog.getByText('Second message')).toBeVisible();
  });

  test('backend receives correct chatId and validates participant', async ({
    page,
  }) => {
    // Set up response interception to check for errors
    let hasAuthError = false;
    let hasParticipantError = false;

    page.on('response', async (response) => {
      if (response.url().includes('/api/chat')) {
        const status = response.status();
        if (status === 401 || status === 403) {
          const text = await response.text().catch(() => '');
          if (text.includes('Not a participant')) {
            hasParticipantError = true;
            console.error('❌ Participant validation error detected');
          } else {
            hasAuthError = true;
            console.error('❌ Authentication error detected');
          }
        }
      }
    });

    await page.goto(`/chat/${chatId}`);

    // Send a message
    const textarea = page.getByPlaceholder('Ask anything...');
    await textarea.fill('Testing participant validation');

    // Wait for API response after submitting
    const submitButton = page.locator('button[type="submit"]').last();
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/chat'),
      {
        timeout: 10000,
      },
    );
    await submitButton.click();
    await responsePromise;

    // Verify no authorization or participant errors occurred
    expect(hasAuthError).toBe(false);
    expect(hasParticipantError).toBe(false);
  });

  test('input is cleared after sending message', async ({ page }) => {
    await page.goto(`/chat/${chatId}`);

    const textarea = page.getByPlaceholder('Ask anything...');
    await textarea.fill('Test message');

    const submitButton = page.locator('button[type="submit"]').last();
    await submitButton.click();

    // Verify textarea is cleared after sending
    await expect(textarea).toHaveValue('');
  });

  test.describe('with mentions', () => {
    test('can add a contact mention to a message', async ({ page }) => {
      await page.goto(`/chat/${chatId}`);

      const textarea = page.getByPlaceholder('Ask anything...');
      await textarea.click();
      // Type like a real user: @ plus min 3 chars to show the mentions dropdown
      await textarea.type('Hello, ');
      await textarea.type('@tes');

      // Wait for the seeded contact (seed: "TEST CONTACT") to appear in the mentions list
      const mentionOption = page.getByRole('option', {
        name: /TEST CONTACT/i,
      });
      await expect(mentionOption).toBeVisible({ timeout: 10000 });
      await mentionOption.click();

      const submitButton = page.locator('button[type="submit"]').last();
      await submitButton.click();

      const chatLog = page.getByRole('log');
      await expect(chatLog.getByText(/Hello,.*TEST CONTACT/)).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('with add-attachments context (contact, company, deal)', () => {
    test('can add contact, company, and deal via Add attachments and submit', async ({
      page,
    }) => {
      await page.goto(`/chat/${chatId}`);

      // Open "Add attachments" menu
      await page.getByRole('button', { name: 'Add attachments' }).click();

      // Add contact: click "Add contact" in menu, select seeded contact, confirm
      await page.getByRole('menuitem', { name: /add contact/i }).click();
      await expect(
        page.getByRole('dialog', { name: /add contacts/i }),
      ).toBeVisible({ timeout: 5000 });
      const contactDialog = page.getByRole('dialog').filter({
        has: page.getByText('Add Contacts'),
      });
      await contactDialog
        .getByRole('button', { name: /TEST CONTACT/i })
        .click();
      await contactDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await contactDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await expect(contactDialog).toBeHidden();

      // Add company: open menu again, "Add company", select seeded company, confirm
      await page.getByRole('button', { name: 'Add attachments' }).click();
      await page.getByRole('menuitem', { name: /add company/i }).click();
      await expect(
        page.getByRole('dialog', { name: /add companies/i }),
      ).toBeVisible({ timeout: 5000 });
      const companyDialog = page.getByRole('dialog').filter({
        has: page.getByText('Add Companies'),
      });
      await companyDialog
        .getByRole('button', { name: /TEST COMPANY/i })
        .click();
      await companyDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await companyDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await expect(companyDialog).toBeHidden();

      // Add deal: open menu again, "Add deal", select seeded deal, confirm
      await page.getByRole('button', { name: 'Add attachments' }).click();
      await page.getByRole('menuitem', { name: /add deal/i }).click();
      await expect(
        page.getByRole('dialog', { name: /add deals/i }),
      ).toBeVisible({ timeout: 5000 });
      const dealDialog = page.getByRole('dialog').filter({
        has: page.getByText('Add Deals'),
      });
      await dealDialog.getByRole('button', { name: /TEST DEAL/i }).click();
      await dealDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await dealDialog
        .getByRole('button', { name: /^Add\s*(\(\d+\))?$/ })
        .click();
      await expect(dealDialog).toBeHidden();

      // Type a message and submit
      const textarea = page.getByPlaceholder('Ask anything...');
      await textarea.fill('get the details');
      const submitButton = page.locator('button[type="submit"]').last();
      await submitButton.click();

      // User message appears in chat
      const chatLog = page.getByRole('log');
      await expect(chatLog.getByText('get the details')).toBeVisible({
        timeout: 5000,
      });
      // AI response starts appearing
      await page.waitForSelector('[data-slot="content"]', { timeout: 15000 });
    });
  });
});
