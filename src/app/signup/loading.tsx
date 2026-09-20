// =============================================================================
// /signup/loading.tsx — branded skeleton shown while the signup page loads
// =============================================================================
// Phase 44: same pattern as /login — the signup form (name, email, phone,
// password + validation) is a client bundle; this keeps the linen page from
// flashing empty while it arrives. Mirrors the real card chrome. Zero JS.
// =============================================================================

export default function SignupLoading() {
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

        {/* Signup card — four fields like the real form */}
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-navy sm:p-8">
          <div className="kozy-skeleton mx-auto h-7 w-48" />
          <div className="kozy-skeleton mx-auto mt-2.5 h-3 w-64 max-w-full" />

          <div className="mt-8 space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="kozy-skeleton h-2.5 w-20" />
                <div className="kozy-skeleton h-10 w-full rounded-lg" />
              </div>
            ))}
            {/* Submit */}
            <div className="kozy-skeleton h-10 w-full rounded-full" />
          </div>
        </div>

        <div className="kozy-skeleton mx-auto mt-6 h-3 w-40" />
      </div>
    </div>
  )
}
