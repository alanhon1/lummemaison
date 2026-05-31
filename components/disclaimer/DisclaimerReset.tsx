'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lumee_disclaimer_agreed';

export default function DisclaimerReset() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const hasResetParam =
      new URLSearchParams(window.location.search).get('reset') === 'true';
    setShow(isDev || hasResetParam);
  }, []);

  if (!show) return null;

  function handleReset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.location.replace(url.toString());
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      className="text-[10px] tracking-[0.2em] uppercase text-gold/80 hover:text-gold transition-colors underline underline-offset-4 decoration-gold/40 hover:decoration-gold"
      aria-label="Reset disclaimer acceptance and reload"
    >
      Reset Disclaimer
    </button>
  );
}
