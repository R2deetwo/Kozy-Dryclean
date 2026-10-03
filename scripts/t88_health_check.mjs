// Sanity: computeCustomerHealth with membership spend
import { computeCustomerHealth, vipCustomerIds } from '../src/lib/customer-health'

const NOW = new Date('2026-10-03T12:00:00Z')
const DAY = 24 * 3600_000
const delivered = (n, daysAgo, price) => ({
  status: 'DELIVERED',
  totalPrice: price,
  deliveredAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
})

// Member: 3 delivered zero-naira bags (plan-covered), ₦50k/month × 2 cycles
const memberOrders = [delivered(1, 40, 0), delivered(2, 30, 0), delivered(3, 20, 0), delivered(4, 8, 0)]
const m = computeCustomerHealth(memberOrders, NOW, 100000)
console.log('MEMBER ltv:', m.ltv, '(expect 100000)', m.ltv === 100000 ? 'PASS' : 'FAIL')
console.log('MEMBER aov:', m.aov, '(expect null — zero-naira orders only)', m.aov === null ? 'PASS' : 'FAIL')
console.log('MEMBER delivered:', m.deliveredCount, '(expect 4)', m.deliveredCount === 4 ? 'PASS' : 'FAIL')

// Same member without the spend join — the old bug
const mOld = computeCustomerHealth(memberOrders, NOW, 0)
console.log('OLD-BEHAVIOUR ltv:', mOld.ltv, '(expect 0 — reproduced the reported bug)', mOld.ltv === 0 ? 'PASS' : 'FAIL')

// Normal customer: 2 delivered orders ₦12k + ₦10.5k, no membership
const normal = computeCustomerHealth([delivered(1, 30, 12000), delivered(2, 9, 10500)], NOW, 0)
console.log('NORMAL ltv:', normal.ltv, '(expect 22500)', normal.ltv === 22500 ? 'PASS' : 'FAIL')
console.log('NORMAL aov:', normal.aov, '(expect 11250)', normal.aov === 11250 ? 'PASS' : 'FAIL')

// VIP cohort: member ranks above the one-off spender
const vip = vipCustomerIds([
  { id: 'member', health: m },
  { id: 'normal', health: normal },
])
console.log('VIP set:', [...vip], '(expect member only)', vip.has('member') && !vip.has('normal') ? 'PASS' : 'FAIL')

// Negative/garbage spend is clamped, never subtracts
const clamp = computeCustomerHealth(memberOrders, NOW, -5000)
console.log('NEGATIVE clamp:', clamp.ltv, '(expect 0)', clamp.ltv === 0 ? 'PASS' : 'FAIL')
