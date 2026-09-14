export function NeuralBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#02040a]">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(56, 189, 248, 0.12), transparent 45%),
            radial-gradient(circle at 80% 20%, rgba(251, 146, 60, 0.1), transparent 40%),
            radial-gradient(circle at 50% 80%, rgba(34, 211, 238, 0.08), transparent 50%)
          `,
        }}
      />
      <svg
        className="absolute left-1/2 top-0 h-[min(90vh,720px)] w-[min(120vw,900px)] -translate-x-1/2 opacity-30"
        viewBox="0 0 400 360"
        aria-hidden
      >
        <defs>
          <linearGradient id="wire" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <ellipse cx="200" cy="180" rx="150" ry="130" fill="none" stroke="url(#wire)" strokeWidth="0.4" opacity="0.5" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a1 = (i / 48) * Math.PI * 2;
          const a2 = a1 + 0.9 + (i % 5) * 0.08;
          const x1 = 200 + Math.cos(a1) * (90 + (i % 7) * 8);
          const y1 = 180 + Math.sin(a1) * (70 + (i % 4) * 10);
          const x2 = 200 + Math.cos(a2) * (40 + (i % 6) * 6);
          const y2 = 180 + Math.sin(a2) * (35 + (i % 3) * 8);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#wire)"
              strokeWidth={0.35 + (i % 3) * 0.15}
              opacity={0.25 + (i % 4) * 0.08}
            />
          );
        })}
      </svg>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(rgba(56,189,248,0.9) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}
