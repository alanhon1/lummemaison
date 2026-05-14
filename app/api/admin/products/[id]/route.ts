import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

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
