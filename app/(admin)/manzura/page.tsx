import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import fs from 'fs';
import path from 'path';
import { sessionOptions, type SessionData } from '@/lib/session';
import DashboardClient from '@/components/admin/DashboardClient';
import { products, categories } from '@/lib/products';

export default async function DashboardPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const backupDir = path.join(process.cwd(), 'data', 'backups');
  let backups: { name: string; size: number; created: string }[] = [];
  if (fs.existsSync(backupDir)) {
    backups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, created: stat.mtime.toLocaleString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 10);
  }

  const noImageCount = products.filter(p => !p.image).length;
  const recent = products.slice(-5).reverse();
  const lastModified = backups[0]?.created ?? 'Never';

  return (
    <DashboardClient
      totalProducts={products.length}
      totalCategories={categories.length}
      noImageCount={noImageCount}
      lastModified={lastModified}
      recentProducts={recent}
      backups={backups}
    />
  );
}
