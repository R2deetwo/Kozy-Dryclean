// =============================================================================
// /login/loading.tsx — branded skeleton shown while the login page loads
// =============================================================================
// Phase 44: the login page is the FIRST screen a returning customer or staff
// member hits; before this file it painted the linen background and nothing
// else until the auth bundle (next-auth + form logic) arrived. Mirrors the
// real page: centered logo, then the sign-in card. Zero JS.
// =============================================================================

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linen px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-2.5">
            <div className="kozy-skeleton h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-4 w-24" />
              <div className="kozy-skeleton h-2.5 w-32" />
            </div>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-navy sm:p-8">
          <div className="kozy-skeleton mx-auto h-7 w-40" />
          <div className="kozy-skeleton mx-auto mt-2.5 h-3 w-56" />

          <div className="mt-8 space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-2.5 w-12" />
              <div className="kozy-skeleton h-10 w-full rounded-lg" />
            </div>
            {/* Password field */}
            <div className="space-y-1.5">
              <div className="kozy-skeleton h-2.5 w-16" />
              <div className="kozy-skeleton h-10 w-full rounded-lg" />
            </div>
            {/* Submit */}
            <div className="kozy-skeleton h-10 w-full rounded-full" />
            {/* Guest hint */}
            <div className="kozy-skeleton mx-auto h-8 w-full rounded-lg" />
          </div>
        </div>

        <div className="kozy-skeleton mx-auto mt-6 h-3 w-28" />
      </div>
    </div>
  )
}
