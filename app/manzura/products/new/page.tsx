import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { categories } from '@/lib/products';
import ProductEditClient from '@/components/admin/ProductEditClient';

export default async function NewProductPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  return <ProductEditClient categories={categories} isNew />;
}
