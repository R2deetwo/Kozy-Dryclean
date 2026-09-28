'use client'

// =============================================================================
// EmailPreviewDialog — ONE preview, everywhere (phase 63)
// =============================================================================
// The exact email a campaign will send, rendered safely inside the console.
//
// WHY THIS EXISTS (the bug it fixes): the campaign-list preview used to load
// /api/marketing/campaigns/[id]/preview directly into <iframe src=…>. The
// app's global security headers (next.config.ts — X-Frame-Options: DENY and
// CSP frame-ancestors 'none', which protect every page from clickjacking)
// apply to that endpoint too, so the browser refused to commit the response
// inside ANY frame. The owner saw Chrome's "broken document" icon the moment
// he previewed an APPROVED (scheduled) newsletter — that is simply the first
// time he reached for the campaign-list Preview button (before approving, he
// previewed from the newsletter-engine card, which already used fetch).
//
// THE FIX: fetch the HTML with the admin's own session (a plain same-origin
// fetch is not subject to frame policies — cookies ride along by default)
// and render it with <iframe srcDoc sandbox="">, exactly how the newsletter
// engine's preview always worked. This one component now powers EVERY
// preview button (engine card, campaign list), so the email looks identical
// wherever it is checked — and the global security headers stay exactly as
// strict as before.
//
// The preview's tracking pixel uses recipientId 'preview', which matches no
// row, so opening a preview never touches the open/click analytics.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface EmailPreviewTarget {
  id: string
  name: string
}

export function EmailPreviewDialog({
  target,
  onClose,
}: {
  target: EmailPreviewTarget | null
  onClose: () => void
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setFailed(false)
    setHtml(null)
    try {
      const res = await fetch(`/api/marketing/campaigns/${id}/preview`)
      if (res.ok) {
        setHtml(await res.text())
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (target) {
      void load(target.id)
    } else {
      // Reset between opens so a stale email can never flash into the next preview
      setHtml(null)
      setFailed(false)
      setLoading(false)
    }
  }, [target, load])

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email preview — {target?.name}</DialogTitle>
          <DialogDescription>
            Exactly what your customers receive — the yellow &ldquo;test copy&rdquo; stripe is
            removed on the real send. Nothing is sent from this screen.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-navy-300">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing the preview…
          </div>
        ) : failed ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-navy-100 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="max-w-sm px-6 text-sm leading-relaxed text-navy-300">
              The preview could not be loaded{target ? ` for “${target.name}”` : ''}. Nothing was
              sent and nothing changed — it is only the preview that failed.
            </p>
            {target && (
              <Button size="sm" variant="outline" onClick={() => void load(target.id)}>
                Try again
              </Button>
            )}
          </div>
        ) : (
          <iframe
            title="Campaign email preview"
            srcDoc={html ?? ''}
            className="h-[65vh] w-full rounded-lg border border-navy-100 bg-white"
            sandbox=""
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
