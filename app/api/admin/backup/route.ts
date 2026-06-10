import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import {
  listBackups,
  createCatalogueBackup,
  restoreBackup,
  deleteBackup,
  readBackup,
} from '@/lib/backup';

// GET            → { backups: BackupMeta[] }
// GET ?preview=… → { products: Product[] }  (for the preview modal)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const name = new URL(req.url).searchParams.get('preview');
  if (name) {
    const products = await readBackup(name);
    if (!products) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ products });
  }
  return NextResponse.json({ backups: await listBackups() });
}

// POST { action: 'create' | 'restore' | 'delete', name? }
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string };

  if (body.action === 'create') {
    try {
      const name = await createCatalogueBackup();
      return NextResponse.json({ ok: true, name });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Backup failed' }, { status: 500 });
    }
  }

  if (body.action === 'restore') {
    const res = await restoreBackup(String(body.name ?? ''));
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (body.action === 'delete') {
    const res = await deleteBackup(String(body.name ?? ''));
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
