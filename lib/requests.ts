import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

// Product demand-request data access. Customers submit these when a product is
// out of stock (see components/catalogue/RequestModal). Admin reads them on the
// Requests page. Service-role only — the table is RLS-locked with no policy
// (see migration 028).

export const REQUESTS_TAG = 'product-requests';

export type RequestStatus = 'open' | 'resolved';

export interface ProductRequest {
  id: number;
  product_id: number;
  product_name: string;
  option: string | null;
  quantity: number;
  user_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  status: RequestStatus;
  created_at: string;
}

// Admin: every request, newest first (low volume, admin-only — no caching).
export async function loadProductRequests(): Promise<ProductRequest[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) return [];
  return data as ProductRequest[];
}

// Count of OPEN requests, for the dashboard button badge. Cached briefly;
// admin mutations call revalidateTag(REQUESTS_TAG).
const openRequestCountCached = unstable_cache(
  async (): Promise<number> => {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('product_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    return count ?? 0;
  },
  ['open-request-count'],
  { tags: [REQUESTS_TAG], revalidate: 60 },
);

export const getOpenRequestCount = cache((): Promise<number> => openRequestCountCached());
