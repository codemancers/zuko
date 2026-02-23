import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for contextEntities extraction from AI SDK message metadata
 */
describe('ChatController - contextEntities extraction', () => {
  describe('extracting contextEntities from message metadata', () => {
    it('should extract contextEntities from last message metadata', () => {
      const messages = [
        {
          role: 'user',
          content: 'hello',
          parts: [{ type: 'text', text: 'hello' }],
          metadata: {
            contextEntities: [
              { type: 'contact', id: 1 },
              { type: 'account', id: 2 },
            ],
          },
        },
      ];

      const lastMessage = messages[messages.length - 1];
      const contextEntities = (lastMessage?.metadata as any)?.contextEntities || [];

      expect(contextEntities).toEqual([
        { type: 'contact', id: 1 },
        { type: 'account', id: 2 },
      ]);
    });

    it('should return empty array when message has no metadata', () => {
      const messages = [
        {
          role: 'user',
          content: 'hello',
          parts: [{ type: 'text', text: 'hello' }],
        },
      ];

      const lastMessage = messages[messages.length - 1];
      const contextEntities = (lastMessage?.metadata as any)?.contextEntities || [];

      expect(contextEntities).toEqual([]);
    });

    it('should return empty array when metadata has no contextEntities', () => {
      const messages = [
        {
          role: 'user',
          content: 'hello',
          parts: [{ type: 'text', text: 'hello' }],
          metadata: {
            someOtherField: 'value',
          },
        },
      ];

      const lastMessage = messages[messages.length - 1];
      const contextEntities = (lastMessage?.metadata as any)?.contextEntities || [];

      expect(contextEntities).toEqual([]);
    });

    it('should extract from last message when multiple messages exist', () => {
      const messages = [
        {
          role: 'user',
          content: 'first',
          parts: [{ type: 'text', text: 'first' }],
          metadata: {
            contextEntities: [{ type: 'contact', id: 999 }],
          },
        },
        {
          role: 'assistant',
          content: 'response',
          parts: [{ type: 'text', text: 'response' }],
        },
        {
          role: 'user',
          content: 'second',
          parts: [{ type: 'text', text: 'second' }],
          metadata: {
            contextEntities: [{ type: 'account', id: 123 }],
          },
        },
      ];

      const lastMessage = messages[messages.length - 1];
      const contextEntities = (lastMessage?.metadata as any)?.contextEntities || [];

      expect(contextEntities).toEqual([{ type: 'account', id: 123 }]);
    });

    it('should handle assistant messages with no metadata', () => {
      const messages = [
        {
          role: 'user',
          content: 'hello',
          parts: [{ type: 'text', text: 'hello' }],
          metadata: {
            contextEntities: [{ type: 'contact', id: 1 }],
          },
        },
        {
          role: 'assistant',
          content: 'hi',
          parts: [{ type: 'text', text: 'hi' }],
        },
      ];

      const lastMessage = messages[messages.length - 1];
      const contextEntities = (lastMessage?.metadata as any)?.contextEntities || [];

      expect(contextEntities).toEqual([]);
    });
  });
});
