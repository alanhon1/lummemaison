// Shared shape passed from the order action into both email templates.

export interface OrderItemLine {
  product_id: number;
  product_name: string;
  unit_cents: number;
  quantity: number;
  line_cents: number;
}

export interface OrderShippingAddress {
  street: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;       // ISO alpha-2
  countryName: string;   // display name, resolved by caller
}

export interface OrderEmailPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: OrderShippingAddress;
  fedexAccount: string | null;
  items: OrderItemLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;     // ISO datetime
  payment: {
    wise: {
      accountName: string;
      bankName: string;
      accountNumber: string;
      swift: string;
    };
    usdt: {
      address: string;
      network: string;
    };
    adminEmail: string;
  };
}

export function formatUSD(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
