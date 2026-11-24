export interface ChatHistoryItem {
  sessionId: string;
  title: string;
  updatedAt: string;
}

const prefix = 'zuko:eve:history:';

function key(scope: string) {
  return `${prefix}${scope}`;
}

export function readChatHistory(scope: string): ChatHistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(key(scope)) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is ChatHistoryItem =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as ChatHistoryItem).sessionId === 'string' &&
          typeof (item as ChatHistoryItem).title === 'string' &&
          typeof (item as ChatHistoryItem).updatedAt === 'string',
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function saveChatHistory(scope: string, item: ChatHistoryItem) {
  const history = readChatHistory(scope).filter((entry) => entry.sessionId !== item.sessionId);
  localStorage.setItem(key(scope), JSON.stringify([item, ...history].slice(0, 50)));
}

export function removeChatHistory(scope: string, sessionId: string) {
  const history = readChatHistory(scope).filter((entry) => entry.sessionId !== sessionId);
  localStorage.setItem(key(scope), JSON.stringify(history));
}
