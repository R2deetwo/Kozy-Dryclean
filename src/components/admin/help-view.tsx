'use client'

// =============================================================================
// HelpView — in-console guide for the Kozy Care admin (requested by the
// project manager, Phase 15). Everything a new operator needs: the daily
// order rhythm, a plain-language tour of every tab, how offers & fees are
// configured (with LIVE values pulled from AppSetting so the numbers here
// can never drift from what the website charges), payment verification,
// and a troubleshooting FAQ. Static content + live settings — no new APIs.
// =============================================================================

import {
  BookOpen,
  CircleCheckBig,
  CreditCard,
  Truck,
  Sparkles,
  Tag,
  Wallet,
  Percent,
  Shirt,
  Building2,
  Wrench,
  LifeBuoy,
  KeyRound,
  AlertTriangle,
  ChevronRight,
  Settings as SettingsIcon,
  KanbanSquare,
  Users as UsersIcon,
  Star,
  MessageSquareHeart,
  Bell,
  LayoutDashboard,
} from 'lucide-react'
import { useAppSettings } from '@/lib/hooks'
import { formatNaira } from '@/lib/types'
import { useStore } from '@/lib/store'

export function HelpView() {
  const app = useAppSettings()
  const settings = useStore((s) => s.settings)

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {/* ---------- Header ---------- */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-400">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-navy">Help &amp; How-To</h1>
            <p className="text-sm text-navy-300">
              Your operating manual for the Kozy Care console — everything you need to run the day.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- 1. The daily rhythm ---------- */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
          <BookOpen className="h-4 w-4 text-gold-500" /> 1 · The daily rhythm — an order&apos;s journey
        </h2>
        <p className="mt-1 text-sm text-navy-300">
          Every order follows the same six stops. Do these checks in order and nothing gets missed.
        </p>
        <ol className="mt-4 space-y-3">
          {[
            {
              icon: Sparkles,
              title: 'New order arrives',
              body: 'A customer (or hotel/corporate client) books on kozycare.ng — guest checkout included. The order appears in Orders instantly and lands in PAYMENT_PENDING_VERIFICATION if they chose bank transfer.',
            },
            {
              icon: CreditCard,
              title: 'Verify the payment',
              body: 'Check your bank statement. When the transfer lands, open Verify Payments, match the amount/order number, and approve. The customer is notified automatically and the order moves to CONFIRMED.',
            },
            {
              icon: Truck,
              title: 'Assign pickup',
              body: 'Move the order card across the Kanban as riders collect the garments. Riders confirm pickup from their own driver app — you just watch the board.',
            },
            {
              icon: Shirt,
              title: 'Cleaning & quality check',
              body: 'Process in-house. Note the Mode of Wash (machine or handwash — handwash adds the care surcharge automatically) and check uploaded condition photos against the garments on arrival.',
            },
            {
              icon: Truck,
              title: 'Out for delivery',
              body: 'Riders deliver. First order = free delivery; after that the flat delivery fee was already charged at checkout, so no math at the door.',
            },
            {
              icon: CircleCheckBig,
              title: 'Delivered & review',
              body: 'Mark delivered. Happy customers are invited to rate the order — 4.5★ and above auto-publish to the site; lower scores wait for you in Reviews.',
            },
          ].map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linen-100 ring-1 ring-navy-100">
                <s.icon className="h-4 w-4 text-navy" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">
                  {i + 1}. {s.title}
                </p>
                <p className="text-sm leading-relaxed text-navy-300">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- 2. Tab tour ---------- */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
          <Wrench className="h-4 w-4 text-gold-500" /> 2 · What each tab does
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: LayoutDashboard,
              name: 'Dashboard',
              body: "Today at a glance — revenue, active orders, pending payments, customer counts. Click any card to jump to that tab.",
            },
            {
              icon: KanbanSquare,
              name: 'Orders',
              body: 'The Kanban board — every order from PAYMENT_PENDING_VERIFICATION to DELIVERED. Drag cards as status changes; open a card for full detail, items, photos and timeline.',
            },
            {
              icon: CreditCard,
              name: 'Verify Payments',
              body: 'Bank-transfer queue. This is the most important tab: an order stays frozen until you approve its payment here. The gold badge counts what is waiting.',
            },
            {
              icon: UsersIcon,
              name: 'Customers',
              body: 'Every account — retail, hotels/corporate and riders. Contact details, order history and spend at a glance.',
            },
            {
              icon: Wallet,
              name: 'Finances',
              body: 'Revenue summaries, payment records and balances — your books for the accountant.',
            },
            {
              icon: Star,
              name: 'Reviews',
              body: 'Order-linked reviews. 4.5★+ auto-approve; anything lower waits here for your decision — approve, hide, or reject.',
            },
            {
              icon: MessageSquareHeart,
              name: 'Feedback',
              body: 'The public Reviews & Complaints form on the website lands here. Work items New → In progress → Resolved and keep an internal note on each.',
            },
            {
              icon: Bell,
              name: 'Notifications',
              body: 'Activity feed for the console — new orders, payment events and status changes.',
            },
            {
              icon: SettingsIcon,
              name: 'Settings',
              body: 'Bank account details, contact info, every price, every offer, delivery fee, handwash surcharge and guarantee thresholds. Changes go live on the website immediately — no redeploy needed.',
            },
          ].map((t) => (
            <div key={t.name} className="rounded-xl border border-navy-100 bg-linen-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <t.icon className="h-4 w-4 text-gold-500" /> {t.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-navy-300">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 3. Offers & fees (live values) ---------- */}
      <section className="rounded-2xl border border-gold-200 bg-navy p-6 text-white shadow-navy">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Percent className="h-4 w-4 text-gold-400" /> 3 · Offers &amp; fees — what the website charges right now
        </h2>
        <p className="mt-1 text-sm text-navy-100/85">
          These are the LIVE values from your Settings — the same numbers customers see at checkout.
          To change any of them: <span className="font-semibold text-gold-300">Settings → Offers &amp; Delivery</span>.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Sparkles,
              label: 'First-order discount (everyone)',
              value: `${app.firstOrderDiscountPercent}% off`,
              note: 'Applied automatically to a new customer\u2019s first order — no code needed.',
            },
            {
              icon: Building2,
              label: `Hotels & corporate offer (${app.hotelGuestPromoCode})`,
              value: `${app.hotelGuestDiscountPercent}% off + 5%`,
              note: 'Code replaces the standard first-order discount; the picture discount still stacks.',
            },
            {
              icon: Tag,
              label: 'Picture discount (guarantee)',
              value: '5% off',
              note: 'Automatic when the customer uploads condition photos at booking — photos also activate the Return-as-Received Guarantee.',
            },
            {
              icon: Truck,
              label: 'Delivery fee',
              value: `First free, then ${formatNaira(app.deliveryFee)}`,
              note: 'First pickup & delivery is free for every new customer; subsequent deliveries are a flat island-wide rate.',
            },
            {
              icon: Shirt,
              label: 'Handwash surcharge',
              value: `+${app.handwashSurchargePercent}% on cleaning`,
              note: 'Added when the customer picks Handwash as their Mode of Wash. Machine wash is standard price.',
            },
            {
              icon: CircleCheckBig,
              label: 'Guarantee eligibility',
              value: `${app.guaranteeMinGarments} garments or ${formatNaira(app.guaranteeMinOrderValue)}`,
              note: 'Orders below this qualify for the 14-day re-clean window only with photos. Adjust both thresholds in Settings.',
            },
            {
              icon: Wrench,
              label: 'Alterations from-price',
              value: app.alterationsFromPrice ? `from ${formatNaira(app.alterationsFromPrice)}` : 'not set yet',
              note: 'Shown on the Alterations section once set. Every job is still quoted before any sewing starts.',
            },
            {
              icon: Wallet,
              label: 'Corporate per-kilogram rate',
              value: `${formatNaira(settings.pricePerKg)} / kg`,
              note: `Weight-based pricing for hotels, estates and restaurants — minimum billable ${settings.minimumKg}kg.`,
            },
          ].map((o) => (
            <div key={o.label} className="rounded-xl bg-white/5 p-4 ring-1 ring-gold-400/20">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gold-200">
                <o.icon className="h-3.5 w-3.5" /> {o.label}
              </p>
              <p className="mt-1 font-serif text-lg font-semibold text-gold-100">{o.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-100/75">{o.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 4. Payments ---------- */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
          <CreditCard className="h-4 w-4 text-gold-500" /> 4 · Payments — bank transfer &amp; your account details
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-navy-300">
          <p>
            Customers can pay <span className="font-semibold text-navy">before pickup</span> by bank
            transfer — the order is created, the site shows your live account details on the booking
            confirmation, and the order waits in <span className="font-semibold text-navy">Verify Payments</span> until
            you approve it. That keeps every order paid before a rider ever leaves the station.
          </p>
          <p>
            <span className="font-semibold text-navy">To change your bank account details:</span> Settings →
            Bank &amp; Contact → edit → Save. The new details are stored on the server and{' '}
            <span className="font-semibold text-navy">appear for every customer immediately</span> — on the booking
            confirmation, the payment page and invoices. No waiting, no redeploy.
          </p>
          <p className="rounded-xl border border-gold-200 bg-gold-50 p-3 text-navy-300">
            <AlertTriangle className="mr-1.5 inline h-4 w-4 text-gold-600" />
            A transfer alert shows the order number in the reference, but always match the{' '}
            <span className="font-semibold text-navy">exact amount</span> too — with discounts and delivery fees,
            the figure is the customer&apos;s safest proof.
          </p>
        </div>
      </section>

      {/* ---------- 5. FAQ ---------- */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
          <AlertTriangle className="h-4 w-4 text-gold-500" /> 5 · Troubleshooting — quick answers
        </h2>
        <div className="mt-4 divide-y divide-navy-100">
          {[
            {
              q: 'Customer says they paid, but the order still shows "payment pending".',
              a: 'Open Verify Payments, find the order number, check the amount against your statement, then approve. If the amounts differ (wrong code used, partial transfer), contact the customer before approving — you can also cancel from the order card.',
            },
            {
              q: "A customer's discount did not apply.",
              a: 'The first-order discount only applies to a customer\u2019s first order. HOTEL15 replaces it when entered at checkout — and only for first orders too. The 5% picture discount applies whenever condition photos are uploaded. Check the order detail: applied discounts are listed line by line.',
            },
            {
              q: 'How do I change a price?',
              a: 'Settings → Pricing. Edit the item price and save — the website, the booking wizard and the price API all update instantly because they read the same server settings.',
            },
            {
              q: 'How do I add or correct the Alterations price?',
              a: 'Settings → Offers & Delivery → Alterations from-price. Until you set it, the website says "quoted before we sew" — so the section works even while you finalize rates with the tailor.',
            },
            {
              q: 'There are test orders in the system (e.g. "E2E Test").',
              a: 'Open the order card and cancel it — cancelled orders drop off the board but stay in the records for audit. Test customer accounts can be removed from Customers.',
            },
            {
              q: 'A guest booked without an account — how do they track the order?',
              a: 'Guests receive their order number at booking. You can resend it, or they can call — the order is fully visible to you in Orders either way.',
            },
            {
              q: 'The website looks cached / my change is not showing.',
              a: 'Settings changes are server-side and appear instantly. For anything else, do a hard refresh (Ctrl/Cmd + Shift + R) before assuming a problem — the site aggressively caches for speed.',
            },
          ].map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-navy">
                {f.q}
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-500 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2 pl-1 text-sm leading-relaxed text-navy-300">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- 6. Access & security ---------- */}
      <section className="rounded-2xl border border-navy-100 bg-linen-50 p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
          <KeyRound className="h-4 w-4 text-gold-500" /> 6 · Access &amp; security
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-navy-300">
          <p>
            <span className="font-semibold text-navy">Admin console:</span> kozycare.ng/admin — sign in at
            kozycare.ng/login with your admin email. Admins see this console; customers land on their
            portal; riders on the driver app — one login page routes everyone correctly.
          </p>
          <p>
            <span className="font-semibold text-navy">Forgot your password?</span> Use &ldquo;Forgot
            password&rdquo; on the login page, or ask your project manager to reset it — resets are immediate.
          </p>
          <p>
            <span className="font-semibold text-navy">Good habits:</span> never share admin logins — create a
            separate account per person who needs access; sign out on shared computers; and if a staff member
            leaves, change their password the same day.
          </p>
        </div>
      </section>
    </div>
  )
}
