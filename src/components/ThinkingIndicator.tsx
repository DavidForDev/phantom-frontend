export default function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Avatar with breathing glow */}
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" />
        {/* Inner orb */}
        <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-300/50">
          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-[spin_2s_linear_infinite]">
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white/80" />
          </div>
          <div className="absolute inset-0 animate-[spin_2s_linear_infinite_reverse]">
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-purple-200/60" />
          </div>
        </div>
      </div>

      {/* Thinking bubble with wave dots */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1.5">ფიქრობს</span>
          <div className="flex gap-1">
            <div
              className="h-2 w-2 rounded-full bg-purple-400"
              style={{ animation: "bounce-dot 1.4s ease-in-out infinite" }}
            />
            <div
              className="h-2 w-2 rounded-full bg-fuchsia-400"
              style={{ animation: "bounce-dot 1.4s ease-in-out 0.2s infinite" }}
            />
            <div
              className="h-2 w-2 rounded-full bg-cyan-400"
              style={{ animation: "bounce-dot 1.4s ease-in-out 0.4s infinite" }}
            />
          </div>
        </div>
      </div>

      {/* Inject keyframes */}
      <style>{`
        @keyframes bounce-dot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
