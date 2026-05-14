import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createBackup } from '@/lib/backup';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');

export async function GET() {
  if (!fs.existsSync(BACKUP_DIR)) return NextResponse.json({ backups: [] });
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stat.size, created: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
  return NextResponse.json({ backups });
}

export async function POST(req: NextRequest) {
  const { filename } = await req.json();
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup(); // backup current state before restoring
  fs.copyFileSync(src, DATA_FILE);
  return NextResponse.json({ ok: true });
}
