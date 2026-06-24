import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { categories } from '@/lib/products';
import PromosClient, { type PromoCode } from '@/components/admin/PromosClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promo Codes' };

export default async function PromosPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <PromosClient
      codes={(data ?? []) as PromoCode[]}
      categories={categories.map(c => ({ id: c.id, name: c.name }))}
    />
  );
}
