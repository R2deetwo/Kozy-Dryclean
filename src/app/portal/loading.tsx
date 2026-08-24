// Loading skeleton shown while the portal page loads
export default function PortalLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen-200 animate-pulse">
      <div className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="h-3 w-24 bg-navy-100 rounded mb-2"></div>
          <div className="h-6 w-40 bg-navy-100 rounded mb-2"></div>
          <div className="h-3 w-56 bg-navy-100 rounded"></div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-navy-100 bg-white p-4">
              <div className="h-3 w-12 bg-navy-100 rounded mb-2"></div>
              <div className="h-6 w-8 bg-navy-100 rounded"></div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-navy-100 bg-white p-5">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-navy-100 rounded"></div>
                  <div className="h-3 w-32 bg-navy-100 rounded"></div>
                  <div className="h-3 w-40 bg-navy-100 rounded"></div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-5 w-16 bg-navy-100 rounded"></div>
                  <div className="h-3 w-12 bg-navy-100 rounded ml-auto"></div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full bg-navy-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
