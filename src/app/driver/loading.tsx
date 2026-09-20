// =============================================================================
// /driver/loading.tsx — branded skeleton shown while the driver app loads
// =============================================================================
// Phase 44: /book, /admin and /portal already swap white blanks for branded
// skeletons; the driver app (staff use it all day on their phones) still
// flashed a dark empty screen while its heavy client bundle (maps, gestures,
// polling) arrived. This mirrors the driver chrome — slate-950 header, stat
// tiles, route list — in the app's own dark tones so the swap feels native.
// Zero JS: a plain server component using animate-pulse.
// =============================================================================

export default function DriverLoading() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Driver header — mirrors driver-view.tsx */}
      <header className="bg-slate-950 px-4 py-4 shadow-lg sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-2.5 w-20 animate-pulse rounded bg-slate-700" />
              <div className="h-5 w-28 animate-pulse rounded bg-slate-700" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-700" />
              <div className="h-5 w-14 animate-pulse rounded bg-slate-700" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4 sm:px-6">
        {/* Stat tiles */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-slate-800 p-3 text-center">
              <div className="mx-auto h-2 w-10 animate-pulse rounded bg-slate-700" />
              <div className="mx-auto mt-2 h-7 w-8 animate-pulse rounded bg-slate-700" />
              <div className="mx-auto mt-1.5 h-2 w-12 animate-pulse rounded bg-slate-700" />
            </div>
          ))}
        </div>

        {/* Route header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-36 animate-pulse rounded bg-slate-700" />
          <div className="h-3 w-14 animate-pulse rounded bg-slate-700" />
        </div>

        {/* Stop cards */}
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="rounded-xl border border-slate-700/60 bg-slate-800 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-slate-700" />
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-700" />
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-700" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="h-5 w-20 animate-pulse rounded-full bg-slate-700" />
                  <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-700" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
