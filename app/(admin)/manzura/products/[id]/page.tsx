import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getProductById, categories } from '@/lib/products';
import ProductEditClient from '@/components/admin/ProductEditClient';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { id } = await params;
  const product = getProductById(parseInt(id));
  if (!product) notFound();
  return <ProductEditClient product={product} categories={categories} />;
}
