"use client";

import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { ChatContextManager, type ChatEntity } from "./ChatContextManager";
import { usePromptInputReferencedSources } from "@zuko/ui-kit";

// Create a context to share the context manager
const ChatContextManagerContext = createContext<ReturnType<typeof ChatContextManager> | null>(null);

interface ChatContextProviderProps {
  children: ReactNode;
  onContextChange?: (entities: ChatEntity[]) => void;
  initialContext?: ChatEntity[];
}

/**
 * Provider component that creates a context manager inside PromptInput
 * This component MUST be used inside a <PromptInput> component tree
 *
 * Usage:
 * <PromptInput>
 *   <ChatContextProvider initialContext={contextEntities}>
 *     {/* Your PromptInput content here *\/}
 *     {/* Use useChatContextManager() hook to access context manager *\/}
 *   </ChatContextProvider>
 * </PromptInput>
 */
export const ChatContextProvider = ({
  children,
  onContextChange,
  initialContext = []
}: ChatContextProviderProps) => {
  // This is safe because ChatContextProvider MUST be used inside PromptInput
  // ChatContextManager calls usePromptInputReferencedSources() internally
  const contextManager = ChatContextManager({ onContextChange });
  const { add } = usePromptInputReferencedSources();

  // Track if we've already injected initialContext to prevent duplicates
  const hasInjectedRef = useRef(false);

  // Inject initial context entities on mount (e.g., from persisted checkpoint state)
  useEffect(() => {
    // Only inject once, even if initialContext changes or component re-mounts
    if (initialContext.length > 0 && !hasInjectedRef.current) {
      console.log('[ChatContextProvider] Injecting initial context:', initialContext);
      hasInjectedRef.current = true;

      // Convert ChatEntity to SourceDocumentUIPart format and add to PromptInput
      initialContext.forEach((entity) => {
        const sourceId = `${entity.type}-${entity.id}`;
        console.log('[ChatContextProvider] Adding entity:', sourceId, entity.name);
        add({
          type: 'source-document',
          sourceId,
          mediaType: 'application/json',
          title: entity.name,
        });
      });
    } else if (initialContext.length === 0) {
      console.log('[ChatContextProvider] No initial context to inject');
    } else {
      console.log('[ChatContextProvider] Already injected, skipping');
    }
  }, [initialContext, add]); // Include deps but guard with ref

  return (
    <ChatContextManagerContext.Provider value={contextManager}>
      {children}
    </ChatContextManagerContext.Provider>
  );
};

/**
 * Hook to access context manager - must be used inside ChatContextProvider
 */
export const useChatContextManager = () => {
  const context = useContext(ChatContextManagerContext);
  if (!context) {
    throw new Error(
      "useChatContextManager must be used within ChatContextProvider"
    );
  }
  return context;
};
