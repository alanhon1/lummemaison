import type ExcelJS from 'exceljs';

export const COLORS = {
  GOLD:  'FFC9A24B',
  DARK:  'FF1F2430',
  CREAM: 'FFF4F1EA',
  BONE:  'FFD9D4C8',
  WHITE: 'FFFFFFFF',
  RED:   'FFDC2626',
  AMBER: 'FFD97706',
  GREEN: 'FF059669',
} as const;

export function thinBorder(argb: string): ExcelJS.Border {
  return { style: 'thin', color: { argb } };
}

export function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: COLORS.WHITE }, name: 'Arial', size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.DARK } };
  cell.border = { bottom: thinBorder(COLORS.GOLD) };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

export function applyDataStyle(cell: ExcelJS.Cell, isEven: boolean): void {
  cell.font = { name: 'Arial', size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? COLORS.CREAM : COLORS.WHITE } };
  cell.border = { bottom: thinBorder(COLORS.BONE) };
  cell.alignment = { vertical: 'middle' };
}

export function applyStatusStyle(cell: ExcelJS.Cell, value: string): void {
  applyDataStyle(cell, false);
  if (value === 'Sold out') {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.RED } };
  } else if (value === 'Low') {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.AMBER } };
  } else if (value === 'OK') {
    cell.font = { name: 'Arial', size: 9, color: { argb: COLORS.GREEN } };
  }
}

export function freezeAndFilter(ws: ExcelJS.Worksheet): void {
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount || 10 } };
}
