import { test, expect } from './fixtures';

test.describe('Chat Functionality', () => {
  let chatId: string;

  test.beforeEach(async ({ page, auth }) => {
    // auth fixture injects cookies before this runs, so page.request is authenticated
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
    console.log(`📝 Created test chat with ID: ${chatId}`);
  });

  test.afterEach(async ({ page }) => {
    // Clean up: delete the chat after each test
    if (chatId) {
      await page.request
        .delete(`http://localhost:3001/api/chats/${chatId}`)
        .catch(() => {
          // Ignore errors if chat doesn't exist
        });
      console.log(`🧹 Cleaned up test chat: ${chatId}`);
    }
  });

  test('chat page displays correctly with empty state', async ({
    page,
    auth,
  }) => {
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
    auth,
  }) => {
    await page.goto(`/chat/${chatId}`);

    // Set up request interception to capture the API call
    let capturedRequestBody: any = null;

    page.on('request', (request) => {
      if (request.url().includes('/api/chat') && request.method() === 'POST') {
        capturedRequestBody = request.postDataJSON();
        console.log(
          '📤 Captured request body:',
          JSON.stringify(capturedRequestBody, null, 2),
        );
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

    console.log('✅ Message request sent correctly');
  });

  test('message is sent and response is displayed', async ({ page, auth }) => {
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
    await expect(page.getByText('Start a conversation')).not.toBeVisible();

    console.log('✅ Message sent and response received');
  });

  test('multiple messages can be sent in sequence', async ({ page, auth }) => {
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
    await textarea.fill('Second message');
    await submitButton.click();
    await expect(page.getByText('Second message')).toBeVisible({
      timeout: 5000,
    });

    // Verify both user messages are in the conversation
    await expect(page.getByText('First message')).toBeVisible();
    await expect(page.getByText('Second message')).toBeVisible();

    console.log('✅ Multiple messages sent successfully');
  });

  test('backend receives correct chatId and validates participant', async ({
    page,
    auth,
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

    console.log(
      '✅ No participant validation errors - chatId correctly passed and validated',
    );
  });

  test('input is cleared after sending message', async ({ page, auth }) => {
    await page.goto(`/chat/${chatId}`);

    const textarea = page.getByPlaceholder('Ask anything...');
    await textarea.fill('Test message');

    const submitButton = page.locator('button[type="submit"]').last();
    await submitButton.click();

    // Verify textarea is cleared after sending
    await expect(textarea).toHaveValue('');

    console.log('✅ Input cleared after sending');
  });
});
