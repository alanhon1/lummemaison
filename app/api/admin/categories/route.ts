import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();
  const data = readData();
  const idx = data.categories.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  data.categories[idx].name = name;
  writeData(data);
  return NextResponse.json({ ok: true });
}
