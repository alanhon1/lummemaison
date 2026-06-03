// Order status vocabulary (matches the CHECK constraint in
// supabase/migrations/006_order_status_flow.sql).
//
// Five forward stages + one escape hatch. The stages appear in the
// customer-facing OrderStepper in this exact order; `cancelled` is rendered
// separately as a banner.

export type OrderStatus =
  | 'order_received'
  | 'payment_verified'
  | 'packaging'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type OrderStage = Exclude<OrderStatus, 'cancelled'>;

export const ORDER_STAGES: OrderStage[] = [
  'order_received',
  'payment_verified',
  'packaging',
  'shipped',
  'delivered',
];

export function isCancelled(status: string): boolean {
  return status === 'cancelled';
}

export function stageIndex(status: string): number {
  const i = (ORDER_STAGES as string[]).indexOf(status);
  return i === -1 ? 0 : i;
}
