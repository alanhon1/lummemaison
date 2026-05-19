'use client';

// Slow-floating gold particles. Mounted once at the app shell.
// pointer-events: none so it never intercepts clicks.

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  // Deterministic position: cluster in left and right 18% of viewport
  const side = i % 2 === 0 ? 'left' : 'right';
  const offsetPct = 2 + ((i * 11) % 16);
  const top = ((i * 17) % 88) + 6;
  const size = (i % 4) + 2; // 2-5 px
  const duration = 9 + (i % 4) * 1.5; // 9-13.5 s
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
            boxShadow: '0 0 6px rgba(201, 169, 110, 0.5)',
            animation: `${p.keyframe} ${p.duration}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
