// =============================================================================
// /admin/loading.tsx — branded skeleton while the Atelier Console loads
// =============================================================================
// Phase 42: the console is a large authenticated client bundle. Before this
// file, /admin showed a blank screen until the JS arrived — jarring for the
// owner opening the dashboard on a phone. Zero-JS server skeleton mirroring
// the console chrome (navy sidebar on desktop, sticky header + stat cards +
// table on mobile) so hydration swaps in seamlessly.
// =============================================================================

export default function AdminLoading() {
  return (
    <div className="flex min-h-screen bg-linen">
      {/* Sidebar (desktop) — mirrors the console's sticky navy rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 bg-navy p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2 pt-2">
          <div className="kozy-skeleton h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <div className="kozy-skeleton h-3.5 w-20" />
            <div className="kozy-skeleton h-2 w-24" />
          </div>
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
            <div className="kozy-skeleton h-4 w-4 rounded" />
            <div className="kozy-skeleton h-3 w-24" style={{ opacity: 0.6 }} />
          </div>
        ))}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile sticky header — mirrors the console's phone chrome */}
        <div className="sticky top-0 z-40 border-b bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="kozy-skeleton h-8 w-8 rounded-lg" />
              <div className="kozy-skeleton h-3.5 w-28" />
            </div>
            <div className="kozy-skeleton h-8 w-8 rounded-full" />
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {/* Page title + tab bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="kozy-skeleton h-6 w-44" />
            <div className="kozy-skeleton h-9 w-32 rounded-full" />
          </div>
          <div className="mb-6 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="kozy-skeleton h-8 w-24 shrink-0 rounded-full" />
            ))}
          </div>

          {/* Stat cards — mirrors the overview grid */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-navy-100 bg-white p-5 shadow-navy">
                <div className="kozy-skeleton mb-3 h-3 w-20" />
                <div className="kozy-skeleton h-7 w-24" />
                <div className="kozy-skeleton mt-3 h-2.5 w-32" />
              </div>
            ))}
          </div>

          {/* Queue/table placeholder */}
          <div className="rounded-xl border border-navy-100 bg-white shadow-navy">
            <div className="border-b border-navy-100 p-4">
              <div className="kozy-skeleton h-4 w-36" />
            </div>
            <div className="divide-y divide-navy-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="kozy-skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="kozy-skeleton h-3 w-40" />
                    <div className="kozy-skeleton h-2.5 w-56 max-w-full" />
                  </div>
                  <div className="kozy-skeleton hidden h-6 w-20 rounded-full sm:block" />
                  <div className="kozy-skeleton h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
