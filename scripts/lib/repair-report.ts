import type { JsonProduct } from './match-products';

export interface ImageReport {
  autoMapped: Array<{ file: string; productId: number; targetPath: string }>;
  needsManual: Array<{ file: string; candidates: Array<{ id: number; name: string; score: number }> }>;
}

export function formatReport(
  imageReport: ImageReport,
  unmatched: JsonProduct[],
): string {
  const lines: string[] = [];
  lines.push('# repair-products report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Auto-mapped images (${imageReport.autoMapped.length})`);
  for (const r of imageReport.autoMapped) {
    lines.push(`  ${r.file}  →  #${r.productId}  →  ${r.targetPath}`);
  }
  lines.push('');
  lines.push(`## Manual-mapping required (${imageReport.needsManual.length})`);
  for (const r of imageReport.needsManual) {
    lines.push(`  ${r.file}`);
    for (const c of r.candidates) {
      lines.push(`     candidate #${c.id} score=${c.score} ${c.name}`);
    }
  }
  lines.push('');
  lines.push(`## Unmatched products (${unmatched.length})`);
  for (const p of unmatched) lines.push(`  #${p.id} (${p.categoryId}) ${p.name}`);
  return lines.join('\n') + '\n';
}
