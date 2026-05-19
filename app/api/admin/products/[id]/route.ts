import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';
import { composeBundleCover } from '@/lib/compose-bundle-cover';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await req.json();
  const data = readData();
  const idx = data.products.findIndex((p: any) => p.id === parseInt(id));
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  data.products[idx] = { ...data.products[idx], ...updates };
  writeData(data);

  // If the saved product belongs to a bundle, regenerate that bundle's
  // composite cover so the catalogue card reflects the new image.
  const saved = data.products[idx];
  const groupId = saved.groupId as string | undefined;
  if (groupId) {
    try {
      const members = data.products.filter((p: any) => p.groupId === groupId);
      if (members.length >= 2) {
        const { outputPath } = await composeBundleCover(groupId, members);
        // Update every group member's groupImage to the regenerated path.
        for (const m of data.products) {
          if (m.groupId === groupId && m.groupImage !== outputPath) {
            m.groupImage = outputPath;
          }
        }
        writeData(data);
      }
    } catch (err) {
      console.warn(`[admin PATCH] bundle re-compose failed for group ${groupId}:`, err);
    }
  }

  return NextResponse.json({ ok: true, product: data.products[idx] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = readData();
  createBackup();
  data.products = data.products.filter((p: any) => p.id !== parseInt(id));
  writeData(data);
  return NextResponse.json({ ok: true });
}
