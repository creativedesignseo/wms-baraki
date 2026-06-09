// Instant skeleton shown while a dynamic (app) page renders on the server.
// Makes navigation feel immediate instead of waiting on a blank screen.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-slate-100" />
    </div>
  );
}
