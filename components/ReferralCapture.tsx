'use client';

import { useEffect } from 'react';

// Captures ?ref=<code> landings: POSTs to /api/ref/track, which counts the
// click and sets the first-touch referral cookie (30 days, never overwritten).
// Reads window.location instead of useSearchParams so the layout doesn't need
// a Suspense boundary; runs once per full page load.
export default function ReferralCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    fetch('/api/ref/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
