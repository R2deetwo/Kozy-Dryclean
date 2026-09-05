// =============================================================================
// Phase 34 — Super-admin account for the client (kozygarmentcare@gmail.com)
// =============================================================================
// Client brief: "create a new super admin account for the client himself,
// using the email on his flyer and business card — kozygarmentcare@gmail.com.
// The one we have at the moment is a fictitious one (admin@kozy.ng) and that
// way he's not able to recover his password."
//
// Production reality (verified this session):
//   - admin@kozy.ng was ALREADY purged in phase 24 (it does not exist).
//   - kozygarmentcare@gmail.com ALREADY exists as an ADMIN (the owner's
//     original customer account, promoted in phase 24, 1 order kept).
// So the correct action is to make THIS account the client's fully usable
// super-admin login:
//   1. system-generated strong password (never chosen by a human)
//   2. mustChangePassword = true  → the console forces him to choose his
//      own password at first sign-in (the phase-32 pattern the client asked
//      for staff, applied to the owner)
//   3. display name set to the client's own name (from his business card:
//      Mr. Orion Akenuwa, Chief Executive Officer)
//   4. branded credentials email sent to kozygarmentcare@gmail.com — the
//      address he controls, so "Forgot password" recovery always reaches him
//
// Run: (with production DATABASE_URL + BREVO_API_KEY in env)
//   npx tsx scripts/phase34-admin-setup.ts
// =============================================================================
import { db } from '../src/lib/db'
import { sendEmail } from '../src/lib/email'
import { generatePassword } from '../src/lib/passwords'
import bcrypt from 'bcryptjs'

const OWNER_EMAIL = 'kozygarmentcare@gmail.com'
const OWNER_NAME = 'Orion Akenuwa'

async function main() {
  const user = await db.user.findUnique({ where: { email: OWNER_EMAIL } })
  if (!user) {
    console.log(`!! ${OWNER_EMAIL} not found in production DB`)
    return
  }
  console.log(`· account found: ${user.email} (role=${user.role}, name="${user.name}")`)

  // 1. system-generated password — the client sets his own at first login
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)

  // 2. update the account (role stays ADMIN, history stays intact)
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      role: 'ADMIN',
      name: OWNER_NAME,
      emailVerified: user.emailVerified ?? new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log(`· password RESET (system-generated) · mustChangePassword=true · name="${OWNER_NAME}" · role=ADMIN`)

  // 3. branded credentials email (transactional — sendEmail tags it so)
  const loginUrl = `https://kozycare.ng/login?email=${encodeURIComponent(OWNER_EMAIL)}`
  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject: 'Your Kozy Care console sign-in — super admin',
      html: `
        <!DOCTYPE html><html><body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
            <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 30px 40px; text-align: center;">
              <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 26px; font-weight: 700; margin: 0;">Kozy Care</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry</p>
            </div>
            <div style="padding: 36px 40px;">
              <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 21px; margin: 0 0 14px 0;">Your super-admin sign-in</h2>
              <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
                This is your Kozy Care owner account. Use the sign-in email and the
                password below to open the operations console. At your first
                sign-in the console will ask you to choose your own password —
                this one is only a starting point.
              </p>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #6F88A8; width: 140px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Sign-in email</td>
                  <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">${OWNER_EMAIL}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Password</td>
                  <td style="padding: 8px 0; color: #0A192F; font-weight: 600;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${password}</code></td>
                </tr>
              </table>
              <div style="text-align:center; margin: 28px 0 8px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px;">Open the console</a>
              </div>
              <p style="color: #6F88A8; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                If you ever forget your password, use “Forgot password” on the
                login page — the reset link always comes to this email address,
                so only you can recover the account. Keep this email private
                until you have set your own password. This is an operational
                account message (not marketing).
              </p>
            </div>
          </div>
        </body></html>`,
    })
    console.log(`· credentials email SENT to ${OWNER_EMAIL}`)
    console.log('\nDONE — the client signs in at https://kozycare.ng/login and sets his own password at first sign-in.')
    console.log('The password exists ONLY in his inbox (not printed here).')
  } catch (e) {
    console.log(`· credentials email FAILED (${e instanceof Error ? e.message : e})`)
    console.log('\nFALLBACK — hand this to the client directly (email could not be delivered):')
    console.log(`  email:    ${OWNER_EMAIL}`)
    console.log(`  password: ${password}`)
    console.log('  (he will still be asked to choose his own at first sign-in)')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
