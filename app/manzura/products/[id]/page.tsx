import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getProductById, categories } from '@/lib/products';
import { getProductStock } from '@/lib/products/stock';
import ProductEditClient from '@/components/admin/ProductEditClient';
import StockInput from '@/components/admin/StockInput';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { id } = await params;
  const numericId = parseInt(id);
  const product = getProductById(numericId);
  if (!product) notFound();
  const initialStock = await getProductStock(numericId);
  return (
    <>
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <StockInput productId={product.id} initialStock={initialStock} />
      </div>
      <ProductEditClient product={product} categories={categories} />
    </>
  );
}
