'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ShoppingBag,
  Receipt,
  Clock,
  Package,
  Sparkles,
  PlusCircle,
  LogOut,
  Loader2,
} from 'lucide-react'
import { useOrders, type ApiOrder } from '@/lib/hooks'
import { formatNaira, formatDate } from '@/lib/types'
import { OrderPipeline } from '@/components/shared/order-pipeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { OrderDetailModal } from './order-detail-modal'
import { InvoiceView } from './invoice-view'
import { BookingWizard } from './booking-wizard'
import { motion } from 'framer-motion'

interface Props {
  initialView?: 'dashboard' | 'booking'
  initialHighlight?: string
  onBackToLanding?: () => void
}

type View =
  | { name: 'dashboard' }
  | { name: 'booking' }
  | { name: 'invoice'; order: any }

export function CustomerPortal({ initialView = 'dashboard', initialHighlight }: Props) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState<View>(
    initialView === 'booking' ? { name: 'booking' } : { name: 'dashboard' }
  )
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(initialHighlight)

  // Loading state while session is being checked
  if (status === 'loading') {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-linen">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  if (!session) {
    router.push('/login')
    return null
  }

  const displayName = session.user?.name ?? 'Customer'
  const displayEmail = session.user?.email ?? ''

  // ----- Booking wizard -----
  if (view.name === 'booking') {
    return (
      <BookingWizard
        onComplete={() => setView({ name: 'dashboard' })}
        onCancel={() => setView({ name: 'dashboard' })}
      />
    )
  }

  // ----- Invoice view -----
  if (view.name === 'invoice') {
    return (
      <InvoiceView
        order={view.order}
        onBack={() => setView({ name: 'dashboard' })}
      />
    )
  }

  // ----- Main dashboard -----
  return (
    <CustomerDashboard
      displayName={displayName}
      displayEmail={displayEmail}
      highlightedId={selectedOrderId}
      onSignOut={() => signOut({ callbackUrl: '/' })}
      onBackToLanding={() => router.push('/')}
      onBook={() => setView({ name: 'booking' })}
      onViewInvoice={(o) => setView({ name: 'invoice', order: o })}
      onCloseDetail={() => setSelectedOrderId(undefined)}
    />
  )
}

// =====================================================
// CUSTOMER DASHBOARD — main authenticated view
// =====================================================
function CustomerDashboard({
  displayName,
  displayEmail,
  highlightedId,
  onSignOut,
  onBackToLanding,
  onBook,
  onViewInvoice,
  onCloseDetail,
}: {
  displayName: string
  displayEmail: string
  highlightedId?: string
  onSignOut: () => void
  onBackToLanding: () => void
  onBook: () => void
  onViewInvoice: (o: any) => void
  onCloseDetail: () => void
}) {
  // Fetch orders from the real API (already RBAC-filtered server-side to this user)
  const { data: orders, isLoading } = useOrders()
  const [tab, setTab] = useState<'active' | 'invoices'>('active')
  const [selected, setSelected] = useState<any | undefined>(
    highlightedId ? orders?.find((o) => o.id === highlightedId) : undefined
  )

  const orderList = orders ?? []
  const activeOrders = orderList.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const pastOrders = orderList.filter((o) => ['DELIVERED', 'CANCELLED'].includes(o.status))

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-linen">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen-200">
      {/* Header */}
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <button
            onClick={onBackToLanding}
            className="mb-2 inline-flex items-center gap-1 text-xs text-navy-300 hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.15em] text-gold-400">Welcome back</p>
              <h1 className="font-serif text-xl font-semibold tracking-tight text-navy sm:text-2xl truncate">
                {displayName}
              </h1>
              <p className="mt-0.5 text-xs text-navy-300 truncate">
                {displayEmail}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
              </Button>
              <Button
                onClick={onBook}
                className="rounded-full bg-gold-gradient text-navy hover:opacity-90"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Book pickup
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-navy-300 sm:text-xs">
                <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Active
              </div>
              <p className="mt-1 font-serif text-lg font-bold text-navy sm:text-2xl">
                {activeOrders.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-navy-300 sm:text-xs">
                <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Past
              </div>
              <p className="mt-1 font-serif text-lg font-bold text-navy sm:text-2xl">
                {pastOrders.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-navy-300 sm:text-xs">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Guarantee
              </div>
              <p className="mt-1 font-serif text-lg font-bold text-navy sm:text-2xl">
                {orderList.filter((o) => o.guaranteeActive).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Orders or empty state */}
        {orderList.length === 0 ? (
          <Card className="border-dashed border-navy-200">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-navy">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <p className="font-medium text-navy">No orders yet</p>
              <p className="max-w-sm text-sm text-navy-300">
                Book your first pickup and it&apos;ll show up here with live tracking.
              </p>
              <Button onClick={onBook} className="mt-2 rounded-full bg-gold-gradient text-navy hover:opacity-90">
                <PlusCircle className="mr-2 h-4 w-4" /> Book pickup
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'invoices')}>
            <TabsList className="bg-linen-200">
              <TabsTrigger value="active" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Active ({activeOrders.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
                <Receipt className="mr-1.5 h-3.5 w-3.5" /> History ({pastOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <div className="space-y-3">
                {activeOrders.map((o) => (
                  <ActiveOrderCard
                    key={o.id}
                    order={o}
                    highlighted={selected?.id === o.id}
                    onView={() => setSelected(o)}
                    onViewInvoice={() => onViewInvoice(o)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <div className="space-y-3">
                {pastOrders.map((o) => (
                  <PastOrderCard
                    key={o.id}
                    order={o}
                    onView={() => setSelected(o)}
                    onViewInvoice={() => onViewInvoice(o)}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Order detail modal */}
      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => {
            setSelected(undefined)
            onCloseDetail()
          }}
          onViewInvoice={(o) => {
            setSelected(undefined)
            onViewInvoice(o)
          }}
        />
      )}
    </div>
  )
}

function ActiveOrderCard({
  order,
  highlighted,
  onView,
  onViewInvoice,
}: {
  order: any
  highlighted?: boolean
  onView: () => void
  onViewInvoice: () => void
}) {
  return (
    <motion.div
      initial={highlighted ? { opacity: 0, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'overflow-hidden transition',
          highlighted
            ? 'border-gold-400 ring-2 ring-gold-200'
            : 'border-navy-100 shadow-navy hover:border-gold-200'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-navy">
                  #{order.orderNumber}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px] text-navy border-navy-200">
                  {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
                </Badge>
                {order.guaranteeActive && <GuaranteeBadge />}
              </div>
              <p className="mt-1 text-xs text-navy-300">
                Pickup: {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
              <p className="text-xs text-navy-300 truncate">{order.pickupAddress}</p>
            </div>
            <div className="text-right shrink-0">
              {order.totalPrice !== undefined ? (
                <>
                  <p className="font-serif text-lg font-bold text-navy">
                    {formatNaira(order.totalPrice)}
                  </p>
                  <p className="text-xs text-navy-300">
                    {order.finalWeight ? `${order.finalWeight}kg · ` : ''}
                    {(() => {
                      try {
                        const items = JSON.parse(order.itemsManifest || '[]')
                        return items.length > 0
                          ? `${items.reduce((s: number, i: any) => s + i.quantity, 0)} items`
                          : 'Bulk'
                      } catch { return 'Bulk' }
                    })()}
                  </p>
                </>
              ) : (
                <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                  Pending weighing
                </Badge>
              )}
            </div>
          </div>

          {/* Progress tracker — mobile-optimized */}
          <div className="mt-4">
            <OrderPipeline order={order} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onView} className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white">
              View details
            </Button>
            {order.totalPrice !== undefined && (
              <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full text-navy-300 hover:text-navy">
                <Receipt className="mr-1 h-3.5 w-3.5" /> Invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function PastOrderCard({
  order,
  onView,
  onViewInvoice,
}: {
  order: any
  onView: () => void
  onViewInvoice: () => void
}) {
  return (
    <Card className="border-navy-100 shadow-navy hover:border-gold-200">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-navy">
              #{order.orderNumber}
            </span>
            {order.status === 'DELIVERED' && (
              <Badge variant="outline" className="rounded-full border-gold-300 bg-gold-50 text-navy">
                Delivered
              </Badge>
            )}
            {order.guaranteeActive && <GuaranteeBadge />}
          </div>
          <p className="mt-1 text-xs text-navy-300">
            {formatDate(order.deliveryDate ?? order.pickupDate)} ·{' '}
            {order.totalPrice ? formatNaira(order.totalPrice) : 'Bulk'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onView} className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white">
            View
          </Button>
          {order.totalPrice !== undefined && (
            <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full text-navy-300 hover:text-navy">
              <Receipt className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// GOLD-FOIL GUARANTEE BADGE
// =====================================================
function GuaranteeBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm"
      style={{
        background: 'linear-gradient(135deg, #E3BE4F 0%, #D4AF37 30%, #F7EBBF 50%, #B8962B 70%, #D4AF37 100%)',
        backgroundSize: '200% 200%',
        color: '#0A192F',
        textShadow: '0 1px 0 rgba(255,255,255,0.4)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(184,150,43,0.3)',
        animation: 'shimmer 4s ease-in-out infinite',
      }}
    >
      <Sparkles className="h-2.5 w-2.5" />
      <span>Guarantee</span>
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </span>
  )
}
