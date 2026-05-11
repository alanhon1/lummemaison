import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');

function verifyAdmin(req: NextRequest): boolean {
  const pw = req.headers.get('x-admin-password');
  return pw === (process.env.ADMIN_PASSWORD || 'changeme123');
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const updates = await req.json();
  const data = readData();

  const idx = data.products.findIndex((p: any) => p.id === parseInt(id));
  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  data.products[idx] = { ...data.products[idx], ...updates };
  writeData(data);

  return NextResponse.json({ ok: true, product: data.products[idx] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const data = readData();
  data.products = data.products.filter((p: any) => p.id !== parseInt(id));
  writeData(data);

  return NextResponse.json({ ok: true });
}
