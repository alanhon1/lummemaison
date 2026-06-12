import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

// Announcements data access.
//
// The customer site reads the active announcements on EVERY page (the popup
// controller is mounted in the locale layout), so — like the catalogue — the
// query is wrapped in `unstable_cache` to avoid hitting the DB once per request.
// Admin mutations call `revalidateTag(ANNOUNCEMENTS_TAG)` for instant freshness;
// the 5-min revalidate is just a safety net. Read/written via the service-role
// client only (the table is RLS-locked with no anon policy — see 021).

export const ANNOUNCEMENTS_TAG = 'announcements';

export type AnnouncementPlacement = 'home' | 'catalogue' | 'both' | 'none';

export interface Announcement {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  placement: AnnouncementPlacement;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const loadActiveAnnouncementsCached = unstable_cache(
  async (): Promise<Announcement[]> => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as Announcement[];
  },
  ['active-announcements'],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 300 },
);

// Active announcements, newest first. React `cache` dedupes within a single
// render; `unstable_cache` dedupes across requests/deployments.
export const loadActiveAnnouncements = cache(
  (): Promise<Announcement[]> => loadActiveAnnouncementsCached(),
);
