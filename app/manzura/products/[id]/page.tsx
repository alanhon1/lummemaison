import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { categories } from '@/lib/products';
import { getProductById } from '@/lib/catalogue';
import { getStockFlagsMap } from '@/lib/products/stock';
import ProductEditClient from '@/components/admin/ProductEditClient';
import StockInput from '@/components/admin/StockInput';
import WonderToggle from '@/components/admin/WonderToggle';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { id } = await params;
  const numericId = parseInt(id);
  const product = await getProductById(numericId);
  if (!product) notFound();
  const flags = (await getStockFlagsMap([numericId]))[numericId];
  return (
    <>
      <div className="max-w-5xl mx-auto px-6 pt-6 space-y-3">
        <StockInput productId={product.id} initialStock={flags.stock} initialUnknown={flags.stockUnknown} />
        <WonderToggle productId={product.id} initialWonder={flags.wonder} />
      </div>
      <ProductEditClient product={product} categories={categories} />
    </>
  );
}
