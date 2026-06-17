import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { loadProductRequests } from '@/lib/requests';
import RequestsClient from '@/components/admin/RequestsClient';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const requests = await loadProductRequests();
  return <RequestsClient requests={requests} />;
}
