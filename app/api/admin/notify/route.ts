// app/api/admin/notify/route.ts
// Phase 2 admin notification composer endpoint. Admin-only. Sends a targeted
// customer notification (inbox row + Web Push to push-ON users) via the Phase-1
// notifyUsers helper. Two shapes:
//   { type: 'product', productId, productName, subtype, note? }
//   { type: 'custom', title, body, url? }
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { notifyUsers } from '@/lib/push/notify';

type ProductSubtype = 'new' | 'restock' | 'benefit';

// Default copy per product subtype. The admin can append a free-text note.
function productCopy(subtype: ProductSubtype, name: string, note?: string): { title: string; body: string } {
  const trimmedNote = (note ?? '').trim();
  const base: Record<ProductSubtype, { title: string; body: string }> = {
    new: { title: 'New arrival ✨', body: `${name} just landed at Lumée.` },
    restock: { title: 'Back in stock', body: `${name} is available again — get it before it's gone.` },
    benefit: { title: `Discover ${name}`, body: `Learn what ${name} can do for your skin.` },
  };
  const c = base[subtype] ?? base.new;
  return { title: c.title, body: trimmedNote ? `${c.body}\n\n${trimmedNote}` : c.body };
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const b = (payload ?? {}) as Record<string, unknown>;

  try {
    if (b.type === 'product') {
      const productId = Number(b.productId);
      const productName = String(b.productName ?? '').trim();
      const subtype = (b.subtype as ProductSubtype) ?? 'new';
      if (!productId || !productName) {
        return NextResponse.json({ ok: false, error: 'Missing product' }, { status: 400 });
      }
      const { title, body } = productCopy(subtype, productName, b.note as string | undefined);
      const res = await notifyUsers({
        title,
        body,
        url: `/product/${productId}`,
        kind: 'product',
        productId,
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (b.type === 'custom') {
      const title = String(b.title ?? '').trim();
      const body = String(b.body ?? '').trim();
      const url = String(b.url ?? '').trim() || undefined;
      if (!title || !body) {
        return NextResponse.json({ ok: false, error: 'Title and message are required' }, { status: 400 });
      }
      const res = await notifyUsers({ title, body, url, kind: 'announcement' });
      return NextResponse.json({ ok: true, ...res });
    }

    return NextResponse.json({ ok: false, error: 'Unknown notification type' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Send failed' },
      { status: 500 },
    );
  }
}
