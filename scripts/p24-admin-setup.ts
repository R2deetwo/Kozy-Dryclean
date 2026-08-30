// =============================================================================
// Phase 24 — Super-admin setup + fabricated-persona purge + alert routing
// =============================================================================
// 1. PROMOTE kozygarmentcare@gmail.com (currently a B2C customer account the
//    owner signed up with) to ADMIN — keeps their order history intact.
// 2. CREATE the ADMIN account practiceprosystems@gmail.com (client request:
//    "add my own email to the super admin list ... that will have a login")
//    and send them a "set your password" email (one-time token, 72h).
// 3. PURGE the fabricated @kozy.ng admin personas from the seed data
//    (concierge@kozy.ng — the made-up email the client disowned — plus
//    admin@kozy.ng and manager@kozy.ng, whose seeded passwords live in the
//    repo: a security hole, not real people). Their order/driver links are
//    handled with the same cascade as the CRM delete.
// 4. POINT admin alerts at BOTH owners:
//    kozygarmentcare@gmail.com,practiceprosystems@gmail.com.
//
// Run: npx tsx scripts/p24-admin-setup.ts   (uses DATABASE_URL from env)
// =============================================================================

import { db } from '../src/lib/db'
import { sendEmail } from '../src/lib/email'
import crypto from 'crypto'

const OWNER_EMAIL = 'kozygarmentcare@gmail.com'
const DEV_ADMIN_EMAIL = 'practiceprosystems@gmail.com'
const FABRICATED = ['concierge@kozy.ng', 'admin@kozy.ng', 'manager@kozy.ng']
const ALERT_LIST = `${OWNER_EMAIL},${DEV_ADMIN_EMAIL}`

async function purgeUser(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    include: { _count: { select: { orders: true, reviews: true, drivenOrders: true } } },
  })
  if (!user) {
    console.log(`· ${email}: already gone`)
    return
  }
  const counts = user._count
  await db.$transaction(async (tx) => {
    await tx.review.updateMany({ where: { approvedById: user.id }, data: { approvedById: null } })
    await tx.verificationToken.deleteMany({ where: { userId: user.id } })
    await tx.driverLocation.deleteMany({ where: { driverId: user.id } })
    await tx.order.deleteMany({ where: { userId: user.id } })
    await tx.review.deleteMany({ where: { userId: user.id } })
    await tx.user.delete({ where: { id: user.id } })
  })
  console.log(
    `· ${email}: DELETED (${counts.orders} owned order(s), ${counts.reviews} review(s), drove ${counts.drivenOrders})`
  )
}

async function main() {
  // ---- 1. Promote the owner -----------------------------------------------
  const owner = await db.user.findUnique({ where: { email: OWNER_EMAIL } })
  if (!owner) {
    console.log(`!! ${OWNER_EMAIL} not found — nothing to promote`)
  } else if (owner.role === 'ADMIN') {
    console.log(`· ${OWNER_EMAIL}: already ADMIN`)
  } else {
    await db.user.update({ where: { id: owner.id }, data: { role: 'ADMIN' } })
    console.log(`· ${OWNER_EMAIL}: PROMOTED ${owner.role} → ADMIN (order history kept)`)
  }

  // ---- 2. Create the developer super-admin --------------------------------
  let dev = await db.user.findUnique({ where: { email: DEV_ADMIN_EMAIL } })
  if (!dev) {
    dev = await db.user.create({
      data: {
        email: DEV_ADMIN_EMAIL,
        name: 'Kozy Super Admin',
        phone: '+234 803 175 5230',
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    })
    console.log(`· ${DEV_ADMIN_EMAIL}: CREATED as ADMIN (no password yet)`)
  } else {
    if (dev.role !== 'ADMIN') {
      await db.user.update({ where: { id: dev.id }, data: { role: 'ADMIN' } })
      console.log(`· ${DEV_ADMIN_EMAIL}: PROMOTED ${dev.role} → ADMIN`)
    } else {
      console.log(`· ${DEV_ADMIN_EMAIL}: already ADMIN`)
    }
  }

  // One-time set-password token (72h) — same flow the forgot-password page uses.
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000)
  await db.verificationToken.deleteMany({ where: { userId: dev.id } })
  await db.verificationToken.create({ data: { token, userId: dev.id, expires } })

  const baseUrl = process.env.NEXTAUTH_URL || 'https://kozycare.ng'
  const setPasswordUrl = `${baseUrl}/reset-password?token=${token}`

  try {
    await sendEmail({
      to: DEV_ADMIN_EMAIL,
      subject: 'Your Kozy Care admin login — set your password',
      html: `
        <!DOCTYPE html><html><body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
            <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
              <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry</p>
            </div>
            <div style="padding: 40px;">
              <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">Admin access granted</h2>
              <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 24px 0;">
                This address is now a Kozy Care administrator and will receive operational
                alert emails (new signups, new orders, bank-transfer verifications).
                Set a password below to sign in to the admin console. The link expires in 72 hours.
              </p>
              <a href="${setPasswordUrl}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px;">
                Set my password
              </a>
              <p style="color: #6F88A8; font-size: 12px; margin: 24px 0 0 0;">
                Or paste this link into your browser:<br>
                <span style="color: #0A192F; word-break: break-all;">${setPasswordUrl}</span>
              </p>
            </div>
          </div>
        </body></html>`,
    })
    console.log(`· set-password email SENT to ${DEV_ADMIN_EMAIL}`)
  } catch (e) {
    console.log(`· set-password email FAILED (${e instanceof Error ? e.message : e}) — link below still works`)
  }
  console.log(`\nSET-PASSWORD LINK (forward to ${DEV_ADMIN_EMAIL}):`)
  console.log(setPasswordUrl)

  // ---- 3. Purge fabricated personas ----------------------------------------
  console.log('\nPurging fabricated @kozy.ng personas:')
  for (const email of FABRICATED) await purgeUser(email)

  // ---- 4. Alert routing: BOTH owners ---------------------------------------
  await db.appSetting.upsert({
    where: { key: 'admin_alerts_email' },
    update: { value: JSON.stringify(ALERT_LIST) },
    create: { key: 'admin_alerts_email', value: JSON.stringify(ALERT_LIST) },
  })
  console.log(`\n· admin_alerts_email = ${ALERT_LIST}`)

  // ---- Report ---------------------------------------------------------------
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, emailVerified: true, passwordHash: true },
    orderBy: { email: 'asc' },
  })
  console.log('\nFinal ADMIN accounts:')
  for (const a of admins)
    console.log(
      `  ${a.email}${a.passwordHash ? '' : ' (no password set yet)'}${a.emailVerified ? '' : ' (unverified)'}`
    )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
