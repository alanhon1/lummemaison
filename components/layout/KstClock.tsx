'use client';

import { useEffect, useState } from 'react';

// Live Seoul (KST) strip shown at the very top of the site. We format an
// absolute instant in the Asia/Seoul time zone, so every visitor sees the
// correct Korean time regardless of their own device timezone. Updates once a
// second. Rendered in the root layout, above the header.
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export default function KstClock() {
  // null until mounted, so the server render and the first client render match
  // (no hydration mismatch); the live values fill in on the client.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full bg-cream border-b border-bone">
      <div className="mx-auto flex items-center justify-center gap-2.5 px-4 py-1 text-[11px] leading-none tracking-wide">
        {/* "Seoul" — shining gold with a thin charcoal outline */}
        <span className="font-bold uppercase tracking-[0.25em] text-gold [-webkit-text-stroke:0.4px_#3A342C] [paint-order:stroke] drop-shadow-[0_0_3px_rgba(212,175,55,0.55)]">
          Seoul
        </span>
        <span className="tabular-nums font-medium text-charcoal" suppressHydrationWarning>
          {now ? TIME_FMT.format(now) : '--:--:--'}
        </span>
        <span className="text-mist/50" aria-hidden>
          |
        </span>
        <span className="text-mist" suppressHydrationWarning>
          {now ? DATE_FMT.format(now) : ' '}
        </span>
      </div>
    </div>
  );
}
