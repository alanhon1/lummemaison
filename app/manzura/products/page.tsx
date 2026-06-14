import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { categories } from '@/lib/products';
import { getAllProducts } from '@/lib/catalogue';
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
  const products = await getAllProducts();

  // Live stock map + admin flags — keyed by product id. Missing rows treat as 0.
  const supabase = createServiceClient();
  const { data: stockRows } = await supabase
    .from('product_stock')
    .select('product_id, stock, wonder, stock_unknown');
  // Sum stock across all options per product for the list display; a product is
  // wonder/unknown in the list if ANY of its options is.
  const stockMap: Record<number, number> = {};
  const wonderIds: number[] = [];
  const unknownIds: number[] = [];
  for (const r of stockRows ?? []) {
    stockMap[r.product_id] = (stockMap[r.product_id] ?? 0) + (r.stock ?? 0);
    if (r.wonder && !wonderIds.includes(r.product_id)) wonderIds.push(r.product_id);
    if (r.stock_unknown && !unknownIds.includes(r.product_id)) unknownIds.push(r.product_id);
  }

  return (
    <ProductsClient
      products={products}
      categories={categories}
      stockMap={stockMap}
      wonderIds={wonderIds}
      unknownIds={unknownIds}
      initialFilter={filter}
    />
  );
}
