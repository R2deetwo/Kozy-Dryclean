// =============================================================================
// Phase 55 — PRODUCTION TEST RIG: let the owner ride the rider app himself
// =============================================================================
// His ask: "i really want to test the rider app and workflow" — the welcome
// emails he received pointed at localhost (now fixed), and no rider account
// he could sign into existed in production anyway.
//
// What this creates (in PRODUCTION, via DIRECT_URL):
//   1. A TEST RIDER account — practiceprosystems+rider@gmail.com (the owner's
//      own Gmail via plus-addressing: distinct from his admin account, same
//      inbox). Initial password KozyTestRider!55, mustChangePassword=true —
//      the rider app itself will walk him through choosing his own.
//   2. A TEST ORDER — #KZ-55555001, PAYMENT_VERIFIED (a pickup stop), assigned
//      to the test rider, customer = his own admin account, guarantee badge
//      ON, Lekki address. Walking it along the Kanban later emails HIM — a
//      genuine production email test with zero risk to any real customer.
//
// The welcome email is sent separately (scripts/p55_send_rider_welcome.ts)
// from the dev environment with EMAIL_OVERRIDE_TO so it lands in
// practiceprosystems@gmail.com with PRODUCTION links.
//
// Run: source work/p55-env.env && DIRECT_URL="$DIRECT_URL" npx tsx scripts/p55_prod_test_rig.ts
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

const RIDER_EMAIL = 'practiceprosystems+rider@gmail.com'
const RIDER_PASSWORD = 'KozyTestRider!55'
const ORDER_NUMBER = 'KZ-55555001'

async function main() {
  // ----- 1. The owner's admin account is the test customer -----
  const owner = await db.user.findUnique({ where: { email: 'practiceprosystems@gmail.com' } })
  if (!owner) throw new Error('Owner admin account not found in prod — aborting')
  console.log(`customer: ${owner.email} (${owner.role})`)

  // ----- 2. The test rider (idempotent) -----
  const hash = await bcrypt.hash(RIDER_PASSWORD, 10)
  const rider = await db.user.upsert({
    where: { email: RIDER_EMAIL },
    update: {
      role: 'DRIVER',
      accessStatus: 'ACTIVE',
      emailVerified: new Date(),
      // Re-arming: the rig is re-runnable; the owner may have already set his
      // own password — we do NOT touch passwordHash unless creating fresh,
      // except when re-running explicitly wants a known state.
    },
    create: {
      email: RIDER_EMAIL,
      name: 'Test Rider (Owner)',
      phone: '+234 803 000 0002',
      role: 'DRIVER',
      passwordHash: hash,
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
      mustChangePassword: true,
    },
  })
  // Always re-arm the known test password (this is a dedicated test account).
  await db.user.update({
    where: { id: rider.id },
    data: { passwordHash: hash, mustChangePassword: true },
  })
  console.log(`rider: ${rider.email} (mustChangePassword=true)`)

  // ----- 3. The test order (idempotent) -----
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
  const existing = await db.order.findUnique({ where: { orderNumber: ORDER_NUMBER } })
  const itemsManifest = JSON.stringify([
    { id: 't1', name: 'White shirt', quantity: 3 },
    { id: 't2', name: 'Navy suit', quantity: 1 },
    { id: 't3', name: 'Silk dress', quantity: 1 },
  ])
  const orderData = {
    userId: owner.id,
    driverId: rider.id,
    status: 'PAYMENT_VERIFIED' as const,
    type: 'ITEM' as const,
    guaranteeActive: true,
    serviceSpeed: 'STANDARD',
    itemsManifest,
    pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    deliveryAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    pickupDate: tomorrow,
    pickupTimeSlot: '09:00 - 10:00',
    totalPrice: 18500,
    // Stage index of PAYMENT_VERIFIED — walking the card further emails at
    // finishing / out for delivery / delivered, all to the owner's inbox.
    lastNotifiedStage: 2,
  }
  const order = existing
    ? await db.order.update({ where: { id: existing.id }, data: orderData })
    : await db.order.create({ data: { orderNumber: ORDER_NUMBER, ...orderData } })
  console.log(`order: #${order.orderNumber} (PAYMENT_VERIFIED, assigned, guarantee on)`)

  console.log('\nRIG READY — next: scripts/p55_send_rider_welcome.ts sends the welcome email')
}

main()
  .catch((e) => {
    console.error('ERR', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
