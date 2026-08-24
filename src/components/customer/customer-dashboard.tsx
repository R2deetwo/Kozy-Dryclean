'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ShoppingBag,
  Receipt,
  Clock,
  Package,
  Sparkles,
  PlusCircle,
} from 'lucide-react'
import { useStore, useOrdersForUser } from '@/lib/store'
import { formatNaira, formatDate, type Order } from '@/lib/types'
import { OrderPipeline } from '@/components/shared/order-pipeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { OrderDetailModal } from './order-detail-modal'
import { InvoiceView } from './invoice-view'

interface Props {
  initialHighlight?: string
  onBack: () => void
  onBook: () => void
  onViewInvoice: (o: Order) => void
}

export function CustomerDashboard({
  initialHighlight,
  onBack,
  onBook,
  onViewInvoice,
}: Props) {
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0])
  const orders = useOrdersForUser(currentUser.id)
  const [tab, setTab] = useState<'active' | 'invoices'>('active')
  const highlighted = initialHighlight
  const [selected, setSelected] = useState<Order | undefined>(
    initialHighlight ? orders.find((o) => o.id === initialHighlight) : undefined
  )

  const activeOrders = orders.filter((o) =>
    !['DELIVERED', 'CANCELLED'].includes(o.status)
  )
  const pastOrders = orders.filter((o) =>
    ['DELIVERED', 'CANCELLED'].includes(o.status)
  )

  const filteredActive = activeOrders
  const filteredPast = pastOrders

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-muted/30">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <button
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-gold-400">
                Welcome back
              </p>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
                {currentUser.name}
              </h1>
              <p className="mt-1 text-sm text-navy-300">
                {currentUser.email} · {currentUser.phone}
              </p>
            </div>
            <Button onClick={onBook} className="rounded-full bg-gold-gradient text-navy hover:opacity-90">
              <PlusCircle className="mr-2 h-4 w-4" /> Book new pickup
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300">
                <Package className="h-3.5 w-3.5" /> Active
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy">{activeOrders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300">
                <Receipt className="h-3.5 w-3.5" /> Past orders
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy">{pastOrders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-navy-300">
                <Sparkles className="h-3.5 w-3.5" /> Guarantee
              </div>
              <p className="mt-1 font-serif text-2xl font-bold text-navy">
                {orders.filter((o) => o.guaranteeActive).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'invoices')}>
          <TabsList className="bg-linen-200">
            <TabsTrigger value="active" className="data-[state=active]:bg-navy data-[state=active]:text-white">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Active ({filteredActive.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-navy data-[state=active]:text-white">
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Invoices &amp; History ({filteredPast.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {filteredActive.length === 0 ? (
              <EmptyState onBook={onBook} />
            ) : (
              <div className="space-y-3">
                {filteredActive.map((o) => (
                  <ActiveOrderCard
                    key={o.id}
                    order={o}
                    highlighted={highlighted === o.id}
                    onView={() => setSelected(o)}
                    onViewInvoice={() => onViewInvoice(o)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {filteredPast.length === 0 ? (
              <EmptyState onBook={onBook} />
            ) : (
              <div className="space-y-3">
                {filteredPast.map((o) => (
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
          onClose={() => setSelected(undefined)}
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
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-navy">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <p className="font-medium text-foreground">No orders here yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
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
          'overflow-hidden transition',
          highlighted
            ? 'border-gold-400 ring-2 ring-gold-200'
            : 'border-muted/60 shadow-sm hover:border-gold-200'
        )}
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  #{order.orderNumber}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
                </Badge>
                {order.guaranteeActive && (
                  <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> Guarantee
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pickup: {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
              <p className="text-xs text-muted-foreground">{order.pickupAddress}</p>
            </div>
            <div className="text-right">
              {order.totalPrice !== undefined ? (
                <>
                  <p className="text-lg font-bold text-foreground">
                    {formatNaira(order.totalPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.finalWeight ? `${order.finalWeight}kg · ` : ''}
                    {order.items.length > 0
                      ? `${order.items.reduce((s, i) => s + i.quantity, 0)} items`
                      : 'B2B bulk'}
                  </p>
                </>
              ) : (
                <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Pending weighing
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4">
            <OrderPipeline order={order} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onView} className="rounded-full">
              View details
            </Button>
            {order.totalPrice !== undefined && (
              <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full">
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
    <Card className="border-muted/60 shadow-sm hover:border-gold-200">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              #{order.orderNumber}
            </span>
            {order.status === 'DELIVERED' && (
              <Badge variant="outline" className="rounded-full bg-gold-50 text-navy-300">
                Delivered
              </Badge>
            )}
            {order.guaranteeActive && (
              <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                <Sparkles className="mr-1 h-2.5 w-2.5" /> Guarantee
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(order.deliveryDate ?? order.pickupDate)} ·{' '}
            {order.totalPrice ? formatNaira(order.totalPrice) : 'B2B bulk'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onView} className="rounded-full">
            View
          </Button>
          {order.totalPrice !== undefined && (
            <Button size="sm" variant="ghost" onClick={onViewInvoice} className="rounded-full">
              <Receipt className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
