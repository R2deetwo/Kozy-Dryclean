#!/usr/bin/env python3
"""Phase 51 — replace the admin order-detail-modal's condition-photos section
(lines verified by od/cat -A to dodge the display-eats-characters gotcha)."""
import sys

PATH = '/home/z/my-project/src/components/admin/order-detail-modal.tsx'

with open(PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Locate the media section: the line `          {media.length > 0 && (` that
# is followed by `<section>` and the `Condition photos` heading.
start = None
for i, ln in enumerate(lines):
    if ln.rstrip('\n') == '          {media.length > 0 && (':
        nxt = lines[i + 1].rstrip('\n') if i + 1 < len(lines) else ''
        if nxt == '            <section>':
            start = i
            break
if start is None:
    print('FAIL: media section start not found')
    sys.exit(1)

# The section ends at the matching `          )}` line.
end = None
for j in range(start + 1, len(lines)):
    if lines[j].rstrip('\n') == '          )}':
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
                  The order record itself is untouched.
                </p>
              )}
            </section>
          )}
'''

lines[start:end + 1] = [new_block]

with open(PATH, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'OK: replaced lines {start + 1}-{end + 1} with the phase-51 media section')
