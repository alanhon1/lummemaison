'use client';

import { Fragment, useEffect, useState } from 'react';

const LAUNCH_AT = new Date('2026-06-07T16:53:41.000Z').getTime();

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function getRemaining() {
  const diff = Math.max(0, LAUNCH_AT - Date.now());
  return {
    h: Math.floor(diff / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1_000),
    done: diff === 0,
  };
}

export default function ComingSoonPage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ h: 0, m: 0, s: 0, done: false });

  useEffect(() => {
    setMounted(true);
    const r = getRemaining();
    setTime(r);
    if (r.done) {
      window.location.replace('/');
      return;
    }
    const id = setInterval(() => {
      const t = getRemaining();
      setTime(t);
      if (t.done) {
        clearInterval(id);
        window.location.replace('/');
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { value: pad(time.h), label: 'Hours' },
    { value: pad(time.m), label: 'Minutes' },
    { value: pad(time.s), label: 'Seconds' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 select-none relative"
      style={{ backgroundColor: '#faf8f5' }}
    >
      <span className="absolute top-5 right-6 font-sans text-[11px] tracking-widest" style={{ color: '#c9a96e', opacity: 0.5 }}>713</span>
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
          <a href="/" className="block mt-6 font-sans text-[11px] tracking-[0.35em] uppercase underline underline-offset-4" style={{ color: '#6b6b6b' }}>
            Enter the Collection
          </a>
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
              --:--:--
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
