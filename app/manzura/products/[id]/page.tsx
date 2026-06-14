import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { categories } from '@/lib/products';
import { getProductById } from '@/lib/catalogue';
import { getProductOptionStock } from '@/lib/products/stock';
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
  const opts = product.options && product.options.length > 0 ? product.options : [''];
  const optionStock = await getProductOptionStock(numericId);
  const flagsFor = (opt: string) =>
    optionStock.find(o => o.option === opt) ?? { stock: 0, wonder: false, stockUnknown: false };
  return (
    <>
      <div className="max-w-5xl mx-auto px-6 pt-6 space-y-4">
        {opts.map(opt => (
          <div key={opt || '_'} className="space-y-2">
            {opt && (
              <p className="text-xs font-semibold text-mist uppercase tracking-widest">{opt}</p>
            )}
            <StockInput
              productId={product.id}
              option={opt}
              initialStock={flagsFor(opt).stock}
              initialUnknown={flagsFor(opt).stockUnknown}
            />
            <WonderToggle productId={product.id} option={opt} initialWonder={flagsFor(opt).wonder} />
          </div>
        ))}
      </div>
      <ProductEditClient product={product} categories={categories} />
    </>
  );
}
