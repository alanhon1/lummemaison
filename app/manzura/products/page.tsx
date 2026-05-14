import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { products, categories } from '@/lib/products';
import ProductsClient from '@/components/admin/ProductsClient';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { filter } = await searchParams;
  return <ProductsClient products={products} categories={categories} initialFilter={filter} />;
}
