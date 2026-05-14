import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 30;

export function createBackup(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${timestamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  files.slice(MAX_BACKUPS).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}

export function readData(): { products: any[]; categories: any[] } {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

export function writeData(data: any): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
