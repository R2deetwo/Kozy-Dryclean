#!/usr/bin/env python3
"""Phase 51 — customer order-detail-modal: same treatment as the admin modal.
1. imports: useState/useEffect
2. media from fetch-on-open (+ mediaCount fallback + purged note)
3. media section JSX: clickable tiles, skeleton, purged note
Line numbers verified via grep first (display may eat chars — we match by
exact line content, not by copying from displayed output)."""
import sys

PATH = '/home/z/my-project/src/components/customer/order-detail-modal.tsx'

with open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

# ---- 1. imports ----
old_import = "import { useMemo } from 'react'"
new_import = "import { useMemo, useState, useEffect } from 'react'"
if old_import not in src:
    print('FAIL: import line not found')
    sys.exit(1)
src = src.replace(old_import, new_import, 1)

# ---- 2. media derivation ----
old_media = '  const media = order.media ?? []'
new_media = '''  // Phase 51: portal list payloads carry a media COUNT, not the bytes — the
  // full photos are fetched once when the modal opens (see the admin modal,
  // same treatment). Photos expire 24h after delivery (the guarantee's claim
  // window); when they are gone the section says so instead of vanishing.
  const mediaCount: number =
    order.mediaCount ?? (Array.isArray(order.media) ? order.media.length : 0)
  const [mediaRows, setMediaRows] = useState<any[] | null>(
    Array.isArray(order.media) ? order.media : null
  )
  useEffect(() => {
    if (mediaCount <= 0 || mediaRows !== null) return
    let alive = true
    fetch(`/api/orders/${order.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        if (alive) setMediaRows(d?.order?.media ?? [])
      })
      .catch(() => {
        if (alive) setMediaRows([])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])
  const media = mediaRows ?? []
  const photosExpired = Boolean(
    order.guaranteeActive &&
      order.deliveredAt &&
      Date.now() - new Date(order.deliveredAt).getTime() > 24 * 3600 * 1000
  )'''
if old_media not in src:
    print('FAIL: media derivation line not found')
    sys.exit(1)
src = src.replace(old_media, new_media, 1)

# ---- 3. media section (match via the line-content anchors) ----
lines = src.split('\n')
start = None
for i, ln in enumerate(lines):
    if ln == '          {media.length > 0 && (':
        if i + 1 < len(lines) and lines[i + 1] == '            <section>':
            start = i
            break
if start is None:
    print('FAIL: media section start not found')
    sys.exit(1)
end = None
for j in range(start + 1, len(lines)):
    if lines[j] == '          )}':
        end = j
        break
if end is None:
    print('FAIL: media section end not found')
    sys.exit(1)

new_block = '''          {(media.length > 0 || (mediaCount > 0 && mediaRows === null) || photosExpired) && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#0A192F]"><Shield className="h-4 w-4 text-[#D4AF37]" /> Condition photos{media.length > 0 ? ` (${media.length})` : mediaCount > 0 ? ` (${mediaCount})` : ''}</h3>
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m: any) => (
                    <a
                      key={m.id}
                      href={m.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open full size"
                      className="aspect-square overflow-hidden rounded-lg ring-1 ring-[#E3BE4F] transition hover:ring-2 hover:ring-[#D4AF37]"
                    >
                      <img src={m.imageUrl} alt="Condition" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {media.length === 0 && mediaCount > 0 && mediaRows === null && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: Math.min(mediaCount, 8) }).map((_, i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-lg bg-[#F1F3F6]" />
                  ))}
                </div>
              )}
              {media.length === 0 && photosExpired && (
                <p className="rounded-lg bg-[#F5F7FA] p-3 text-xs text-[#6F88A8]">
                  The 24-hour claim window after delivery has closed, so this order's condition
                  photos were removed — exactly as the Return-as-Received Guarantee terms provide.
                </p>
              )}
            </section>
          )}'''

lines[start:end + 1] = new_block.split('\n')
src = '\n'.join(lines)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'OK: customer modal patched (media section at line {start + 1})')
