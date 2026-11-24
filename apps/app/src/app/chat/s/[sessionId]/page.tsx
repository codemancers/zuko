import { Chat } from '@/components/chat/chat';

export const metadata = { title: 'Chat' };

export default async function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <Chat key={sessionId} sessionId={sessionId} />;
}
