// Stable identity for a (product, option) cap, shared by the caps API route and
// the client cap store. Always includes the option slot (unlike cartLineKey,
// which omits it for optionless products) so both sides agree on the lookup key.
export function capKey(id: number, option?: string): string {
  return `${id}::${option ?? ''}`;
}
