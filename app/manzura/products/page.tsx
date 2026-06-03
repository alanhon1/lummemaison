import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { products, categories } from '@/lib/products';
import { createServiceClient } from '@/lib/supabase/server';
import ProductsClient from '@/components/admin/ProductsClient';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { filter } = await searchParams;

  // Live stock map — keyed by product id. Products without a row treat as 0.
  const supabase = createServiceClient();
  const { data: stockRows } = await supabase
    .from('product_stock')
    .select('product_id, stock');
  const stockMap: Record<number, number> = {};
  for (const r of stockRows ?? []) stockMap[r.product_id] = r.stock;

  return (
    <ProductsClient
      products={products}
      categories={categories}
      stockMap={stockMap}
      initialFilter={filter}
    />
  );
}
