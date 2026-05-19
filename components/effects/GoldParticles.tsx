'use client';

// Slow-floating gold particles. Mounted once at the app shell.
// pointer-events: none so it never intercepts clicks.

const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  // Deterministic position: cluster in left and right 20% of viewport
  const side = i % 2 === 0 ? 'left' : 'right';
  const offsetPct = 2 + ((i * 7) % 18);
  const top = ((i * 13) % 90) + 5;
  const size = (i % 3) + 1;
  const duration = 18 + (i % 5) * 2;
  const keyframe = `float-${(i % 6) + 1}`;
  return { side, offsetPct, top, size, duration, keyframe };
});

export default function GoldParticles() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: `${p.top}%`,
            [p.side]: `${p.offsetPct}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: '#c9a96e',
            borderRadius: '50%',
            opacity: 0,
            boxShadow: '0 0 4px rgba(201, 169, 110, 0.4)',
            animation: `${p.keyframe} ${p.duration}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
