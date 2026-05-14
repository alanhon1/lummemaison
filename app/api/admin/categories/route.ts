import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();

  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  let data: { products: any[]; categories: any[] };
  try {
    data = readData();
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }

  const idx = data.categories.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  data.categories[idx].name = name;
  writeData(data);
  return NextResponse.json({ ok: true });
}
