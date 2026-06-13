import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import UsersClient, { type UserRow } from '@/components/admin/UsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();

  const [authResult, profilesResult, ordersResult] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('customer_profiles').select('user_id, full_name, phone, customer_code, city, country, created_at, email_verified'),
    admin.from('orders').select('user_id, total_cents, status'),
  ]);

  if (profilesResult.error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display text-4xl font-light text-charcoal mb-4">Users</h1>
        <p className="text-sm text-red-600">Failed to load users: {profilesResult.error.message}</p>
      </div>
    );
  }

  // Map every auth user by ID — we now list all customers (email confirmation is
  // optional), reading the address from auth.users and the verified state from
  // our own customer_profiles.email_verified flag.
  const authMap = new Map(
    (authResult.data?.users ?? []).map(u => [u.id, u]),
  );

  const orderRows = ordersResult.data ?? [];

  const rows: UserRow[] = (profilesResult.data ?? [])
    .map(p => {
      const authUser = authMap.get(p.user_id as string);
      const userOrders = orderRows.filter(
        o => o.user_id === p.user_id && o.status !== 'cancelled',
      );
      return {
        user_id: p.user_id as string,
        full_name: (p.full_name as string) ?? '',
        email: authUser?.email ?? '',
        email_verified: (p.email_verified as boolean) ?? false,
        phone: (p.phone as string) ?? '',
        customer_code: (p.customer_code as string | null) ?? null,
        city: (p.city as string) ?? '',
        country: (p.country as string) ?? '',
        created_at: p.created_at as string,
        order_count: userOrders.length,
        total_spent_cents: userOrders.reduce((s, o) => s + ((o.total_cents as number) ?? 0), 0),
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <UsersClient rows={rows} />;
}
