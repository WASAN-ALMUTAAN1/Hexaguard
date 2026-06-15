export default function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="glass-card relative overflow-hidden p-6 text-[#d4d4d4]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(74,215,255,0.12),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(255,52,52,-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(74,215,255,0.12),transparent_34%),radial-gradient0.10),transparent_34%)]" />

      <div className="relative z-10 flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-[#4ad7ff]/30 bg-[#4ad7ff]/10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        </div>

        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
            Processing
          </p>
          <p className="mt-2 text-sm leading-6 text-[#d4d4d4]">{message}</p>
        </div>
      </div>
    </div>
  );
}
