// Instant feedback shown while a dynamic (app) page renders on the server.
// Minimal centered pulse: brand mark + mono caption.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24" aria-hidden>
      <div className="h-8 w-8 animate-pulse rounded-lg bg-brand shadow-[0_2px_8px_rgba(225,25,49,0.35)]" />
      <p className="font-[family-name:var(--font-num)] text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Cargando…
      </p>
    </div>
  );
}
