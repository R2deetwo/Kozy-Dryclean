'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { MilestonePage } from '@/components/customer/milestone-page'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-navy-300" />
        </div>
      }
    >
      <MilestonePageRouter />
    </Suspense>
  )
}

function MilestonePageRouter() {
  // The appreciation email links here with ?token=… (HMAC-signed) so the
  // customer can open it on any device without signing in first.
  const token = useSearchParams().get('token') || undefined
  return <MilestonePage token={token} />
}
