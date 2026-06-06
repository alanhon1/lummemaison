import dynamic from 'next/dynamic';

// ssr:false → countdown only runs in the browser, zero hydration mismatch
const Countdown = dynamic(() => import('./Countdown'), { ssr: false });

export default function ComingSoonPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 select-none"
      style={{ backgroundColor: '#faf8f5' }}
    >
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

      <Countdown />

      <div style={{ width: 1, height: 40, backgroundColor: '#c9a96e', opacity: 0.35 }} className="mt-14" />

      <p className="font-sans text-[9px] tracking-[0.3em] uppercase mt-14" style={{ color: '#b5aba0' }}>
        Premium Korean Aesthetic Products
      </p>
    </div>
  );
}
