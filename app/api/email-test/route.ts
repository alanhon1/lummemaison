// TEMPORARY — delete this file after manual SMTP verification.
// Visit GET /api/email-test in dev to dispatch a dummy order through
// sendOrderEmails() and return the delivery result as JSON. Both messages
// (customer + admin) are addressed to ADMIN_NOTIFICATION_EMAIL so they land
// in the admin inbox during the dry-run.

import { NextResponse } from 'next/server';
import { sendOrderEmails, type OrderData } from '@/lib/email/sendOrderEmails';

export async function GET() {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'test@example.com';

  const dummy: OrderData = {
    orderNumber: 'LM-TEST-0001',
    customerName: 'Test Customer',
    customerEmail: recipient,
    customerPhone: '+82 10-0000-0000',
    shippingAddress: {
      street: '123 Sample St',
      city: 'Seoul',
      postal_code: '04524',
      country: 'KR',
      countryName: 'South Korea',
    },
    country: 'South Korea',
    items: [
      { name: 'Sample Cream 50ml', quantity: 2, price: 1999 },
      { name: 'Sample Serum 30ml', quantity: 1, price: 3450 },
    ],
    subtotal: 7448,
    shipping: 1500,
    total: 8948,
    currency: 'USD',
  };

  const result = await sendOrderEmails(dummy);
  return NextResponse.json(result);
}
