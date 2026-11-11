import { redirect } from 'next/navigation';

// The dashboard shows a log-in prompt to signed-out visitors, so it doubles as the landing page.
export default function Index() {
  redirect('/dashboard');
}
