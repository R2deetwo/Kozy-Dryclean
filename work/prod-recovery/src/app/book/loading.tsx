// =============================================================================
// /book/loading.tsx — branded skeleton shown while the booking wizard loads
// =============================================================================
// Phase 42: the wizard is the heaviest client bundle on the site; before this
// file, navigating to /book showed a blank white screen until the JS arrived.
// This skeleton is a server component (zero JS) with the same chrome as the
// real page, so the swap when the wizard hydrates feels continuous — the
// "major SaaS app" loading pattern the owner asked for.
// =============================================================================

export default function BookLoading() {
  return (
    <div className="min-h-screen bg-linen">
      {/* Sticky nav — mirrors page.tsx so the header never jumps on swap */}
      <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="kozy-skeleton h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-3.5 w-20" />
              <div className="kozy-skeleton h-2 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="kozy-skeleton h-8 w-20 rounded-full" />
            <div className="kozy-skeleton h-8 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Wizard shell */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 text-center">
          <div className="kozy-skeleton mx-auto h-6 w-64" />
          <div className="kozy-skeleton mx-auto mt-3 h-3 w-80 max-w-full" />
        </div>

        {/* Step chips */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kozy-skeleton h-8 w-20 rounded-full sm:w-28" />
          ))}
        </div>

        {/* Service grid card */}
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-navy sm:p-6">
          <div className="mb-4 flex gap-2">
            <div className="kozy-skeleton h-9 w-24 rounded-full" />
            <div className="kozy-skeleton h-9 w-24 rounded-full" />
            <div className="kozy-skeleton h-9 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-navy-100/70 p-3">
                <div className="kozy-skeleton h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="kozy-skeleton h-3 w-16" />
                  <div className="kozy-skeleton h-2.5 w-12" />
                </div>
              </div>
            ))}
          </div>
          {/* Sticky total bar placeholder */}
          <div className="mt-6 flex items-center justify-between rounded-xl bg-navy-50 p-4">
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-3 w-24" />
              <div className="kozy-skeleton h-2.5 w-32" />
            </div>
            <div className="kozy-skeleton h-10 w-36 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
