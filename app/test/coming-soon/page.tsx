'use client';

import { Fragment, useEffect, useRef, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function TestComingSoonPage() {
  const launchAt = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ m: 0, s: 0, done: false });

  function getRemaining() {
    const diff = Math.max(0, launchAt.current - Date.now());
    return {
      m: Math.floor(diff / 60_000),
      s: Math.floor((diff % 60_000) / 1_000),
      done: diff === 0,
    };
  }

  useEffect(() => {
    launchAt.current = Date.now() + 60_000; // 1 minute from now
    setMounted(true);
    const r = getRemaining();
    setTime(r);

    const id = setInterval(() => {
      const t = getRemaining();
      setTime(t);
      if (t.done) {
        clearInterval(id);
        window.location.replace('/');
      }
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = [
    { value: pad(time.m), label: 'Minutes' },
    { value: pad(time.s), label: 'Seconds' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 select-none"
      style={{ backgroundColor: '#faf8f5' }}
    >
      {/* TEST badge */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase"
        style={{ backgroundColor: '#fde68a', color: '#92400e' }}
      >
        TEST PAGE — auto-redirects to / when timer hits 0
      </div>

      <p className="font-sans text-[10px] tracking-[0.45em] uppercase mb-20" style={{ color: '#c9a96e' }}>
        Lumée Maison
      </p>

      <h1
        className="font-display font-light text-charcoal text-center leading-tight mb-3"
        style={{ fontSize: 'clamp(1.8rem, 5vw, 3.5rem)' }}
      >
        The House of Light
      </h1>
      <p
        className="font-display font-light italic text-center mb-14"
        style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)', color: '#9a9087' }}
      >
        opens in&hellip;
      </p>

      <div style={{ width: 1, height: 40, backgroundColor: '#c9a96e', opacity: 0.35 }} className="mb-14" />

      {time.done ? (
        <div className="text-center">
          <p className="font-display font-light" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', color: '#c9a96e' }}>
            We&apos;re Live
          </p>
          <p className="mt-4 font-sans text-[11px] tracking-[0.25em] uppercase" style={{ color: '#6b6b6b' }}>
            Redirecting…
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 sm:gap-8">
          {mounted ? units.map(({ value, label }, i) => (
            <Fragment key={label}>
              {i > 0 && (
                <span className="font-display font-light leading-none mt-2 sm:mt-4" style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', color: '#c9a96e', opacity: 0.45 }}>:</span>
              )}
              <div className="flex flex-col items-center gap-3">
                <span
                  className="font-display font-light tabular-nums leading-none"
                  style={{ fontSize: 'clamp(3.5rem, 12vw, 9rem)', color: '#c9a96e', textShadow: '0 0 40px rgba(201,169,110,0.18)' }}
                >
                  {value}
                </span>
                <span className="font-sans text-[8px] sm:text-[9px] tracking-[0.35em] uppercase" style={{ color: '#b5aba0' }}>
                  {label}
                </span>
              </div>
            </Fragment>
          )) : (
            <span className="font-display font-light tabular-nums" style={{ fontSize: 'clamp(3.5rem, 12vw, 9rem)', color: '#c9a96e', opacity: 0.3 }}>
              --:--
            </span>
          )}
        </div>
      )}

      <div style={{ width: 1, height: 40, backgroundColor: '#c9a96e', opacity: 0.35 }} className="mt-14" />

      <p className="font-sans text-[9px] tracking-[0.3em] uppercase mt-14" style={{ color: '#b5aba0' }}>
        Premium Korean Aesthetic Products
      </p>
    </div>
  );
}
