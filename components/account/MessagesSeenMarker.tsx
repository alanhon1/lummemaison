'use client';

import { useEffect } from 'react';
import { markMessagesSeen } from '@/app/[locale]/account/orders/[seq]/actions';

// Tiny client component: fires markMessagesSeen() once on mount so the
// unread-message badge on the dashboard list resets after the customer
// has actually loaded the detail page. Renders nothing visually.
export default function MessagesSeenMarker({ orderId }: { orderId: number }) {
  useEffect(() => {
    // Fire and forget — failures are silent (the badge stays one render
    // longer, no UX harm).
    void markMessagesSeen(orderId);
  }, [orderId]);
  return null;
}
