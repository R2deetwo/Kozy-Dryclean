// =============================================================================
// Phase 63 — reproduce the owner's bug: email preview breaks AFTER scheduling
// =============================================================================
// Seeds the LOCAL QA database with exactly what the owner was looking at:
//   1. the battery admin persona (kozy-a-admin@woosh.dpdns.org)
//   2. the newsletter engine ON with a pending automation DRAFT (slot ~3 days
//      out — future-dated so approving it can never trigger a live send)
//
// The SCHEDULED state is produced through the REAL UI (Approve button), so
// the reproduction follows the owner's exact path: preview the draft →
// approve → preview the scheduled campaign.
//
// Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
//        npx tsx scripts/p63_seed.ts
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ADMIN = {
  email: 'kozy-a-admin@woosh.dpdns.org',
  password: 'KozyAutoAdmin!56',
  name: 'Test Auto Admin',
  phone: '+234 803 000 0018',
}

const BODY_TEXT = `Hi there,

Fabric care small talk: the harmattan dust is settling into everything, and honestly your suits feel it before you do. A gentle professional wash now keeps the weave soft instead of stiff.

**This fortnight's members-only perk** — free pickup and delivery on every order, no minimum. Just book as usual and the membership quietly covers it.

Three quick reminders:
- Duvets and heavy blankets ride the quarterly deep-clean cycle
- Suede and leather pieces always get the assessment-first treatment
- Express turnaround is 48 hours, book before noon for same-day pickup

See you at the door,
The Kozy Care team`

// Same conversion the composer uses (plainTextToEmailHtml) — inlined here so
// the seed script does not drag the whole app dependency graph in.
function plainTextToEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const autolink = (s: string): string =>
    s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)]+)/g, (_m, pre: string, url: string) => {
      const href = url.startsWith('www.') ? `https://${url}` : url
      return `${pre}<a href="${href}" style="color: #0A192F; text-decoration: underline;">${url}</a>`
    })
  const bold = (s: string): string => s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  const italic = (s: string): string => s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  return escaped
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => `<p style="margin: 0 0 16px 0;">${italic(bold(autolink(para))).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

async function main() {
  // 1) admin persona
  const hash = await bcrypt.hash(ADMIN.password, 10)
  await db.user.upsert({
    where: { email: ADMIN.email },
    update: { role: 'ADMIN', accessStatus: 'ACTIVE', emailVerified: new Date(), passwordHash: hash, mustChangePassword: false },
    create: {
      email: ADMIN.email,
      name: ADMIN.name,
      phone: ADMIN.phone,
      role: 'ADMIN',
      accessStatus: 'ACTIVE',
      emailVerified: new Date(),
      passwordHash: hash,
      mustChangePassword: false,
    },
  })
  console.log('admin persona ready:', ADMIN.email)

  // 2) engine ON, next slot ~3 days out (never due during QA)
  const slot = new Date(Date.now() + 3 * 24 * 3600 * 1000)
  await db.marketingSchedule.upsert({
    where: { id: 'main' },
    update: { enabled: true, cadenceWeeks: 2, dayOfWeek: 4, sendTime: '09:00', nextSlotDate: slot, currentWeekIndex: 2 },
    create: { id: 'main', enabled: true, cadenceWeeks: 2, dayOfWeek: 4, sendTime: '09:00', nextSlotDate: slot, currentWeekIndex: 2 },
  })
  console.log('engine on, slot:', slot.toISOString())

  // 3) the pending automation DRAFT (delete any previous p63 drafts first)
  await db.newsletterCampaign.deleteMany({ where: { name: { startsWith: 'p63 —' } } })
  const draft = await db.newsletterCampaign.create({
    data: {
      name: 'p63 — Harmattan care (auto draft)',
      subject: 'The harmattan is eating your suits (gently fixable)',
      bodyText: BODY_TEXT,
      htmlContent: plainTextToEmailHtml(BODY_TEXT),
      segment: 'ALL',
      status: 'DRAFT',
      source: 'automation',
      slotDate: slot,
      bannerSlug: 'tips-fabric',
    },
  })
  console.log('draft ready:', draft.id, 'slotDate', draft.slotDate?.toISOString())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
