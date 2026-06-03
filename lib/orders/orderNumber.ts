// Single source of truth for the display form of an order number.
// Every UI, email, page title, and admin panel renders order numbers via this
// function so a change to the format is one edit, not a scavenger hunt.
export function formatOrderNumber(seq: number): string {
  return `SGL #${String(seq).padStart(6, '0')}`;
}
