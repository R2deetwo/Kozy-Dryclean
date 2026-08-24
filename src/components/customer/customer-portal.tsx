'use client'

import { useState, useMemo } from 'react'
import {
  ArrowLeft,
  ShoppingBag,
  Receipt,
  Clock,
  Package,
  Sparkles,
  PlusCircle,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import { useStore, useOrdersForUser } from '@/lib/store'
import { formatNaira, formatDate, type Order, type User } from '@/lib/types'
import { OrderPipeline } from '@/components/shared/order-pipeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { OrderDetailModal } from './order-detail-modal'
import { InvoiceView } from './invoice-view'
import { BookingWizard } from './booking-wizard'
import { motion } from 'framer-motion'

interface Props {
  initialView?: 'dashboard' | 'booking'
  initialHighlight?: string
  onBackToLanding: () => void
}

type View =
  | { name: 'auth' }
  | { name: 'dashboard' }
  | { name: 'booking' }
  | { name: 'invoice'; order: Order }

export function CustomerPortal({ initialView = 'dashboard', initialHighlight, onBackToLanding }: Props) {
  const currentUserId = useStore((s) => s.currentUserId)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const users = useStore((s) => s.users)
  const currentUser = users.find((u) => u.id === currentUserId)

  const [view, setView] = useState<View>(
    currentUser ? { name: initialView } : { name: 'auth' }
  )
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(initialHighlight)

  // ----- Auth gate -----
  if (!currentUser || view.name === 'auth') {
    return (
      <AuthGate
        users={users}
        onSignIn={(user) => {
          setCurrentUser(user.id)
          setView({ name: 'dashboard' })
        }}
        onBackToLanding={onBackToLanding}
      />
    )
  }

  // ----- Booking wizard -----
  if (view.name === 'booking') {
    return (
      <BookingWizard
        onComplete={(order) => {
          setSelectedOrderId(order.id)
          setView({ name: 'dashboard' })
        }}
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
      userId={currentUserId}
      highlightedId={selectedOrderId}
      onSignOut={() => {
        setCurrentUser('') // reset
        setView({ name: 'auth' })
        onBackToLanding()
      }}
      onBackToLanding={onBackToLanding}
      onBook={() => setView({ name: 'booking' })}
      onViewInvoice={(o) => setView({ name: 'invoice', order: o })}
      onCloseDetail={() => setSelectedOrderId(undefined)}
    />
  )
}

// =====================================================
// AUTH GATE — phone/email entry, customer lookup
// =====================================================
function AuthGate({
  users,
  onSignIn,
  onBackToLanding,
}: {
  users: User[]
  onSignIn: (u: User) => void
  onBackToLanding: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = identifier.trim().toLowerCase()
    if (!q) {
      setError('Please enter your phone number or email.')
      return
    }
    const match = users.find(
      (u) =>
        (u.role === 'B2C' || u.role === 'B2B') &&
        (u.email.toLowerCase().includes(q) || u.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    )
    if (match) {
      setError('')
      onSignIn(match)
    } else {
      setError('No account found. Try one of the demo accounts below.')
    }
  }

  const demoCustomers = users.filter((u) => u.role === 'B2C' || u.role === 'B2B')

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen dark:bg-navy-900">
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <button
          onClick={onBackToLanding}
          className="mb-6 inline-flex items-center gap-1 text-xs text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to landing
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold-400 dark:bg-gold-400 dark:text-navy">
              <UserIcon className="h-6 w-6" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-navy dark:text-white">
              Welcome to your portal
            </h1>
            <p className="mt-1 text-sm text-navy-300 dark:text-navy-200">
              Sign in to track orders, view invoices &amp; book new pickups.
            </p>
          </div>

          <Card className="border-navy-100 bg-white shadow-navy dark:border-navy-600 dark:bg-navy-800">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="identifier" className="text-xs uppercase tracking-wide text-navy-300 dark:text-navy-200">
                    Phone or Email
                  </Label>
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="+234 807 444 1122 or chioma.eze@gmail.com"
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-gold-gradient text-navy hover:opacity-90"
                >
                  Sign in to portal
                </Button>
              </form>

              <div className="mt-5 divider-gold" />

              <p className="mt-4 text-[10px] uppercase tracking-wider text-navy-300 dark:text-navy-200">
                Demo accounts (click to sign in)
              </p>
              <ul className="mt-2 space-y-1.5">
                {demoCustomers.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => onSignIn(u)}
                      className="flex w-full items-center gap-3 rounded-lg border border-navy-100 bg-linen-50 px-3 py-2 text-left text-xs transition hover:border-gold-300 hover:bg-gold-50 dark:border-navy-600 dark:bg-navy-700 dark:hover:border-gold-400 dark:hover:bg-navy-600"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-gold-400 dark:bg-gold-400 dark:text-navy">
                        {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-navy dark:text-white">{u.name}</p>
                        <p className="truncate text-[10px] text-navy-300 dark:text-navy-200">
                          {u.email} · {u.role === 'B2B' ? 'Corporate' : 'Retail'}
                        </p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-navy-300 dark:text-navy-200" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// =====================================================
// CUSTOMER DASHBOARD — main authenticated view
// =====================================================
function CustomerDashboard({
  userId,
  highlightedId,
  onSignOut,
  onBackToLanding,
  onBook,
  onViewInvoice,
  onCloseDetail,
}: {
  userId: string
  highlightedId?: string
  onSignOut: () => void
  onBackToLanding: () => void
  onBook: () => void
  onViewInvoice: (o: Order) => void
  onCloseDetail: () => void
}) {
  const currentUser = useStore((s) => s.users.find((u) => u.id === userId))
  const orders = useOrdersForUser(currentUser?.id ?? '')
  const [tab, setTab] = useState<'active' | 'invoices'>('active')
  const [selected, setSelected] = useState<Order | undefined>(
    highlightedId ? orders.find((o) => o.id === highlightedId) : undefined
  )
  // Guard — userId should always be valid because auth gate runs first
  if (!currentUser) return null

  const activeOrders = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const pastOrders = orders.filter((o) => ['DELIVERED', 'CANCELLED'].includes(o.status))

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen-200 dark:bg-navy-900">
      {/* Header */}
      <header className="border-b border-navy-100 bg-white dark:border-navy-600 dark:bg-navy-800">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <button
            onClick={onBackToLanding}
            className="mb-2 inline-flex items-center gap-1 text-xs text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-gold-400">
                Welcome back
              </p>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy dark:text-white sm:text-3xl">
                {currentUser.name}
              </h1>
              <p className="mt-1 text-sm text-navy-300 dark:text-navy-200">
                {currentUser.email} · {currentUser.phone}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white dark:border-navy-500 dark:text-navy-100 dark:hover:bg-navy-600"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
              </Button>
              <Button
                onClick={onBook}
                className="rounded-full bg-gold-gradient text-navy hover:opacity-90"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Book new pickup
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="border-navy-100 shadow-navy dark:border-navy-600 dark:bg-navy-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300 dark:text-navy-200">
                <Package className="h-3.5 w-3.5" /> Active
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy dark:text-white">
                {activeOrders.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy dark:border-navy-600 dark:bg-navy-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300 dark:text-navy-200">
                <Receipt className="h-3.5 w-3.5" /> Past orders
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy dark:text-white">
                {pastOrders.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy dark:border-navy-600 dark:bg-navy-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300 dark:text-navy-200">
                <Sparkles className="h-3.5 w-3.5" /> Guarantee
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy dark:text-white">
                {orders.filter((o) => o.guaranteeActive).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'invoices')}>
          <TabsList className="bg-linen-200 dark:bg-navy-700">
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-navy data-[state=active]:text-white dark:data-[state=active]:bg-gold-400 dark:data-[state=active]:text-navy"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Active ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="data-[state=active]:bg-navy data-[state=active]:text-white dark:data-[state=active]:bg-gold-400 dark:data-[state=active]:text-navy"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Invoices &amp; History ({pastOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {activeOrders.length === 0 ? (
              <EmptyState onBook={onBook} />
            ) : (
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
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {pastOrders.length === 0 ? (
              <EmptyState onBook={onBook} />
            ) : (
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
            )}
          </TabsContent>
        </Tabs>
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

function EmptyState({ onBook }: { onBook: () => void }) {
  return (
    <Card className="border-dashed border-navy-200 dark:border-navy-600 dark:bg-navy-800">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-navy dark:bg-navy-700 dark:text-gold-400">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <p className="font-medium text-navy dark:text-white">No orders here yet</p>
        <p className="max-w-sm text-sm text-navy-300 dark:text-navy-200">
          Book your first pickup and it&apos;ll show up here with live tracking.
        </p>
        <Button onClick={onBook} className="mt-2 rounded-full bg-gold-gradient text-navy hover:opacity-90">
          <PlusCircle className="mr-2 h-4 w-4" /> Book pickup
        </Button>
      </CardContent>
    </Card>
  )
}

function ActiveOrderCard({
  order,
  highlighted,
  onView,
  onViewInvoice,
}: {
  order: Order
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
          'overflow-hidden transition dark:bg-navy-800',
          highlighted
            ? 'border-gold-400 ring-2 ring-gold-200'
            : 'border-navy-100 shadow-navy hover:border-gold-200 dark:border-navy-600 dark:hover:border-gold-400'
        )}
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-navy dark:text-white">
                  #{order.orderNumber}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px] dark:border-navy-500 dark:text-navy-200">
                  {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
                </Badge>
                {order.guaranteeActive && (
                  <GuaranteeBadge />
                )}
              </div>
              <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">
                Pickup: {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
              <p className="text-xs text-navy-300 dark:text-navy-200">{order.pickupAddress}</p>
            </div>
            <div className="text-right">
              {order.totalPrice !== undefined ? (
                <>
                  <p className="font-serif text-lg font-bold text-navy dark:text-white">
                    {formatNaira(order.totalPrice)}
                  </p>
                  <p className="text-xs text-navy-300 dark:text-navy-200">
                    {order.finalWeight ? `${order.finalWeight}kg · ` : ''}
                    {order.items.length > 0
                      ? `${order.items.reduce((s, i) => s + i.quantity, 0)} items`
                      : 'Corporate bulk'}
                  </p>
                </>
              ) : (
                <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100 dark:bg-gold-400/20 dark:text-gold-200">
                  Pending weighing
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4">
            <OrderPipeline order={order} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onView} className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white dark:border-navy-500 dark:text-navy-100 dark:hover:bg-navy-600">
              View details
            </Button>
            {order.totalPrice !== undefined && (
              <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white">
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
  order: Order
  onView: () => void
  onViewInvoice: () => void
}) {
  return (
    <Card className="border-navy-100 shadow-navy hover:border-gold-200 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-navy dark:text-white">
              #{order.orderNumber}
            </span>
            {order.status === 'DELIVERED' && (
              <Badge variant="outline" className="rounded-full border-gold-300 bg-gold-50 text-navy dark:border-gold-400 dark:bg-gold-400/20 dark:text-gold-200">
                Delivered
              </Badge>
            )}
            {order.guaranteeActive && <GuaranteeBadge />}
          </div>
          <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">
            {formatDate(order.deliveryDate ?? order.pickupDate)} ·{' '}
            {order.totalPrice ? formatNaira(order.totalPrice) : 'Corporate bulk'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onView} className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white dark:border-navy-500 dark:text-navy-100 dark:hover:bg-navy-600">
            View
          </Button>
          {order.totalPrice !== undefined && (
            <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white">
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
export function GuaranteeBadge() {
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
      <Shield className="h-2.5 w-2.5" />
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
