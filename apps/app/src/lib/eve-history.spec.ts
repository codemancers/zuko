import { readChatHistory, removeChatHistory, saveChatHistory } from './eve-history';

describe('Eve chat history', () => {
  beforeEach(() => localStorage.clear());

  it('keeps history isolated by user and organization', () => {
    saveChatHistory('user-1:org-1', {
      sessionId: 'session-1',
      title: 'Pipeline review',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });

    expect(readChatHistory('user-1:org-1')).toHaveLength(1);
    expect(readChatHistory('user-1:org-2')).toEqual([]);
    expect(readChatHistory('user-2:org-1')).toEqual([]);
  });

  it('updates an existing session without creating a duplicate', () => {
    saveChatHistory('scope', {
      sessionId: 'session-1',
      title: 'First title',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });
    saveChatHistory('scope', {
      sessionId: 'session-1',
      title: 'Updated title',
      updatedAt: '2026-11-24T01:00:00.000Z',
    });

    expect(readChatHistory('scope')).toEqual([
      {
        sessionId: 'session-1',
        title: 'Updated title',
        updatedAt: '2026-11-24T01:00:00.000Z',
      },
    ]);
  });

  it('ignores malformed storage and removes only the requested session', () => {
    localStorage.setItem('zuko:eve:history:broken', '{');
    expect(readChatHistory('broken')).toEqual([]);

    saveChatHistory('scope', {
      sessionId: 'keep',
      title: 'Keep',
      updatedAt: '2026-11-24T00:00:00.000Z',
    });
    saveChatHistory('scope', {
      sessionId: 'remove',
      title: 'Remove',
      updatedAt: '2026-11-24T01:00:00.000Z',
    });
    removeChatHistory('scope', 'remove');

    expect(readChatHistory('scope').map((item) => item.sessionId)).toEqual(['keep']);
  });
});
