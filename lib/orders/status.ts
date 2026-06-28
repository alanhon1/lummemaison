// Order status vocabulary (matches the CHECK constraint in
// supabase/migrations/006_order_status_flow.sql).
//
// Five forward stages + one escape hatch. The stages appear in the
// customer-facing OrderStepper in this exact order; `cancelled` is rendered
// separately as a banner.

export type OrderStatus =
  | 'quote_pending'
  | 'awaiting_payment'
  | 'order_received'
  | 'payment_verified'
  | 'packaging'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// The five fulfilment stages shown in the customer stepper. quote_pending and
// awaiting_payment are pre-fulfilment and excluded from this array.
export type OrderStage = Exclude<OrderStatus, 'cancelled' | 'quote_pending' | 'awaiting_payment'>;

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

export function isQuoteStatus(status: string): boolean {
  return status === 'quote_pending' || status === 'awaiting_payment';
}

export function stageIndex(status: string): number {
  const i = (ORDER_STAGES as string[]).indexOf(status);
  return i === -1 ? 0 : i;
}
