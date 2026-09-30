// =============================================================================
// Task 78 — the pricing ladder, checked at unit level (every tier × every
// rung). The owner's phase-77 numbers must stay EXACT; 6 and 12 step the
// saving up gently (7.5% / 10%). Run by t78_run_verify.sh before the server.
// =============================================================================
import { renewalPriceFor, renewalSavingFor, RENEWAL_MONTH_CHOICES } from '../src/lib/types'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function main() {
  console.log('[t78-pricing] the standing ladder')

  // The owner's own numbers, unchanged from phase 77.
  ok('Essentials 3 months = ₦85,000 (the owner\'s decision)', renewalPriceFor(30000, 3) === 85000, `got ${renewalPriceFor(30000, 3)}`)
  ok('Essentials 3-month saving = ₦5,000', renewalSavingFor(30000, 3) === 5000, `got ${renewalSavingFor(30000, 3)}`)
  ok('Household 3 months = ₦141,500', renewalPriceFor(50000, 3) === 141500, `got ${renewalPriceFor(50000, 3)}`)
  ok('Whole Home 3 months = ₦226,500', renewalPriceFor(80000, 3) === 226500, `got ${renewalPriceFor(80000, 3)}`)

  // The deeper rungs — modest, human, round to ₦500.
  const table: Array<[string, number, number, number, number]> = [
    // tier, monthly, 3mo, 6mo, 12mo
    ['Essentials', 30000, 85000, 166500, 324000],
    ['Household', 50000, 141500, 277500, 540000],
    ['Whole Home', 80000, 226500, 444000, 864000],
    ['Shoe Club', 3000, 8500, 16500, 32500],
  ]
  for (const [tier, monthly, three, six, twelve] of table) {
    ok(`${tier} 6 months = ₦${six.toLocaleString()}`, renewalPriceFor(monthly, 6) === six, `got ${renewalPriceFor(monthly, 6)}`)
    ok(`${tier} 12 months = ₦${twelve.toLocaleString()}`, renewalPriceFor(monthly, 12) === twelve, `got ${renewalPriceFor(monthly, 12)}`)
    const s6 = renewalSavingFor(monthly, 6)
    const s12 = renewalSavingFor(monthly, 12)
    // The ₦500 rounding dominates the smallest tier (Shoe Club ₦3,000/mo →
    // ₦1,350 saving rounds to ₦1,500), so the % tolerance widens there.
    const tol = monthly < 10000 ? 0.028 : 0.002
    ok(`${tier} 6-month saving = ₦${s6.toLocaleString()} (~7.5% shape)`, Math.abs(s6 / (monthly * 6) - 0.075) < tol, `${(s6 / (monthly * 6) * 100).toFixed(2)}%`)
    ok(`${tier} 12-month saving = ₦${s12.toLocaleString()} (~10% shape)`, Math.abs(s12 / (monthly * 12) - 0.1) < tol, `${(s12 / (monthly * 12) * 100).toFixed(2)}%`)
    // Monotonic: every deeper rung saves at least as much per month.
    const s3 = renewalSavingFor(monthly, 3)
    ok(`${tier} savings deepen per rung`, s6 / 6 >= s3 / 3 - 1 && s12 / 12 >= s6 / 6 - 1, `per-month: 3mo ${Math.round(s3 / 3)} / 6mo ${Math.round(s6 / 6)} / 12mo ${Math.round(s12 / 12)}`)
    // The per-month figure only drops — never rises above full price.
    ok(`${tier} 12-month per-month < monthly price`, renewalPriceFor(monthly, 12) / 12 < monthly)
  }

  // Monthly stays full price; non-ladder counts stay plain × months.
  ok('1 month = the plan price (no discount)', renewalPriceFor(30000, 1) === 30000)
  ok('non-ladder count (2) = plain 2 × price', renewalPriceFor(30000, 2) === 60000)
  ok('saving is 0 off the ladder', renewalSavingFor(30000, 2) === 0 && renewalSavingFor(30000, 1) === 0)

  // The choices constant carries the whole ladder.
  ok('RENEWAL_MONTH_CHOICES = [1, 3, 6, 12]', JSON.stringify(RENEWAL_MONTH_CHOICES) === '[1,3,6,12]')

  console.log(`[t78-pricing] ${pass} pass, ${fail} fail`)
  if (fail > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
