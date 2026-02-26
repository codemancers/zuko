interface ChatLayoutProps {
  children: React.ReactNode;
  params: Promise<{ chatId: string }>;
}

export async function generateMetadata({ params }: ChatLayoutProps) {
  const { chatId } = await params;

  try {
    // Fetch chat title from backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/chats/${chatId}`, {
      cache: 'no-store',
    });

    if (response.ok) {
      const chat = await response.json();
      return {
        title: chat.title || 'Chat',
      };
    }
  } catch (error) {
    console.error('Failed to fetch chat for metadata:', error);
  }

  return {
    title: 'Chat',
  };
}

export default function ChatDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
