'use client'

// =============================================================================
// /book — public booking page (guest checkout)
// =============================================================================
// The landing page's "Book Pickup" CTAs send visitors here instead of /signup.
// Signed-in users book normally; guests provide contact details in the wizard
// and a customer record is created server-side with their order.
// =============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowLeft, KeyRound, CreditCard } from 'lucide-react'
import { BookingWizard } from '@/components/customer/booking-wizard'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatNaira, type Order } from '@/lib/types'
import { useStore } from '@/lib/store'

export default function BookPage() {
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [guestCreated, setGuestCreated] = useState(false)
  const settings = useStore((s) => s.settings)

  // ===== Post-booking success screen =====
  if (placedOrder) {
    // The API response includes payments (Prisma include) even though the
    // shared Order type doesn't declare them — cast for the check.
    const apiOrder = placedOrder as Order & { payments?: { method: string; status: string }[] }
    const needsBankTransfer =
      placedOrder.status === 'PAYMENT_PENDING_VERIFICATION' &&
      apiOrder.payments?.some((p) => p.method === 'BANK_TRANSFER' && p.status === 'PENDING')

    return (
      <div className="min-h-screen bg-gradient-to-b from-linen-200 to-white">
        {/* Top nav */}
        <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Logo size="md" subtitle="Premium Drycleaning & Laundry" onClick={() => (window.location.href = '/')} />
            <Link href="/login">
              <Button variant="outline" size="sm" className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white">
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100"
            >
              <CheckCircle2 className="h-8 w-8 text-gold-600" />
            </motion.div>
            <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Your pickup is booked!
            </h1>
            <p className="mt-3 text-navy-300">
              Order <strong className="text-navy">#{placedOrder.orderNumber}</strong> is confirmed
              {placedOrder.pickupDate && (
                <> — pickup on{' '}
                  <strong className="text-navy">
                    {new Date(placedOrder.pickupDate).toLocaleDateString('en-NG', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </strong>{' '}
                  ({placedOrder.pickupTimeSlot}).
                </>
              )}{' '}
              We&apos;ve emailed your confirmation.
            </p>
          </motion.div>

          {/* Bank transfer details (when paying manually) */}
          {needsBankTransfer && !!placedOrder.totalPrice && (
            <Card className="mt-8 border-gold-200 bg-gold-50/40">
              <CardContent className="p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <CreditCard className="h-4 w-4 text-gold-600" /> Complete your payment
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-navy-300">Bank</span>
                    <span className="font-medium">{settings.bankName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-navy-300">Account name</span>
                    <span className="font-medium">{settings.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-navy-300">Account number</span>
                    <span className="font-mono font-bold text-navy">{settings.accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-navy-300">Amount</span>
                    <span className="font-bold text-navy">{formatNaira(placedOrder.totalPrice)}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-navy-300">
                  Use <strong className="text-navy">#{placedOrder.orderNumber}</strong> as the transfer
                  narration so we can match it quickly.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Guest: set a password to track the order */}
          {guestCreated && (
            <Card className="mt-4 border-navy-100">
              <CardContent className="p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <KeyRound className="h-4 w-4 text-gold-600" /> Track this order
                </p>
                <p className="mt-1.5 text-sm text-navy-300">
                  You booked as a guest — we saved your details so you never have to re-type them.
                  Check your email and set a password to track this order and book again in seconds.
                </p>
                <Button
                  className="mt-4 w-full bg-[#0A192F] text-white hover:bg-[#1B3A5F]"
                  onClick={() => (window.location.href = '/forgot-password')}
                >
                  Set my password
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/portal" className="w-full">
              <Button variant="outline" className="w-full border-navy-200 text-navy hover:bg-navy hover:text-white">
                Track my order
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = '/')}
              className="text-navy-300 hover:text-navy"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ===== The wizard itself =====
  return (
    <div className="min-h-screen bg-gradient-to-b from-linen-200 to-white">
      <BookingWizard
        allowGuest
        onComplete={(order, meta) => {
          setPlacedOrder(order)
          setGuestCreated(!!meta?.guestAccountCreated)
        }}
        onCancel={() => (window.location.href = '/')}
      />
    </div>
  )
}
