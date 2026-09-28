// =============================================================================
// /review/[orderId]/loading.tsx — branded skeleton for the review page
// =============================================================================
// Phase 44: customers land here from the "Rate" button in their portal (and
// from review links in emails/SMS). The form fetches order context and
// renders stars + a message box; this skeleton keeps the linen page from
// flashing empty while that bundle loads. Zero JS.
// =============================================================================

export default function ReviewLoading() {
  return (
    <div className="min-h-screen bg-linen">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2.5">
            <div className="kozy-skeleton h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-4 w-24" />
              <div className="kozy-skeleton h-2.5 w-32" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="mt-10 text-center">
          <div className="kozy-skeleton mx-auto h-8 w-64 max-w-full" />
          <div className="kozy-skeleton mx-auto mt-3 h-3 w-80 max-w-full" />
        </div>

        {/* Order summary card */}
        <div className="mt-8 rounded-2xl border border-navy-100 bg-white p-5 shadow-navy">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="kozy-skeleton h-3 w-28" />
              <div className="kozy-skeleton h-2.5 w-36" />
            </div>
            <div className="kozy-skeleton h-9 w-24 rounded-full" />
          </div>
        </div>

        {/* Rating + message card */}
        <div className="mt-6 rounded-2xl border border-navy-100 bg-white p-5 shadow-navy sm:p-6">
          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="kozy-skeleton h-9 w-9 rounded-full" />
            ))}
          </div>
          {/* Message box */}
          <div className="kozy-skeleton mt-6 h-28 w-full rounded-xl" />
          {/* Submit */}
          <div className="kozy-skeleton mx-auto mt-5 h-10 w-48 rounded-full" />
        </div>
      </div>
    </div>
  )
}
