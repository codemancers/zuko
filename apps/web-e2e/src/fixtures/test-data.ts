/**
 * Test data fixtures
 * Contains sample data for testing
 */

export const TEST_CONTACTS = {
  validContact: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    company: 'Acme Corp',
  },
  anotherContact: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+0987654321',
    company: 'Tech Industries',
  },
  invalidContact: {
    firstName: '',
    lastName: '',
    email: 'invalid-email',
    phone: 'abc',
  },
};

export const TEST_BEADS = {
  taskBead: {
    title: 'Test Task Bead',
    description: 'This is a test task bead',
    type: 'task',
    priority: 'medium',
  },
  bugBead: {
    title: 'Test Bug Bead',
    description: 'This is a test bug bead',
    type: 'bug',
    priority: 'high',
  },
  featureBead: {
    title: 'Test Feature Bead',
    description: 'This is a test feature bead',
    type: 'feature',
    priority: 'low',
  },
};

export const TEST_MESSAGES = {
  simple: 'Hello, this is a test message',
  question: 'What is the weather like today?',
  multiline: 'This is a\nmultiline\nmessage',
};

export const TEST_SETTINGS = {
  github: {
    connected: true,
    username: 'testuser',
    repository: 'test-repo',
  },
};

/**
 * Generate unique test data with timestamp
 */
export function generateUniqueTestData<T extends Record<string, unknown>>(
  baseData: T
): T {
  const timestamp = Date.now();
  const result = { ...baseData };

  // Add timestamp to string fields
  Object.keys(result).forEach((key) => {
    if (typeof result[key] === 'string') {
      result[key] = `${result[key]}_${timestamp}` as T[Extract<keyof T, string>];
    }
  });

  return result;
}
