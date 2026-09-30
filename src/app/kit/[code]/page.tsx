import type { Metadata } from 'next'
import { KitScanClient } from './kit-client'

// Phase 75 — the destination of the QR on every Kozy Bag / Kozy Box.
// Scanned by staff on the wash floor and riders in the van: whose bag this
// is, the plan, the cycle usage. noindex — a utility URL, never organic.

export const metadata: Metadata = {
  title: 'Kozy Kit Tag — Kozy Care',
  description: 'Kit tag scan — Kozy Circle member identification.',
  robots: { index: false, follow: false },
}

export default async function KitTagPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <KitScanClient code={code} />
}
