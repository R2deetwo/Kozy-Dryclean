'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  ShoppingCart,
  Truck,
  Package,
  WashingMachine,
  Wind,
  Home,
  AlertCircle,
  Building2,
  User,
  Shield,
  Clock,
  Zap,
  List,
  KanbanSquare,
  ChevronRight,
} from 'lucide-react'
import { useOrders, useUpdateOrder, ADMIN_POLL } from '@/lib/hooks'
import { useMemo, useState } from 'react'
import {
  KANBAN_COLUMNS,
  formatNaira,
  formatDate,
  type Order,
  type OrderStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { OrderDetailModal } from './order-detail-modal'
import { LiveBadge } from './payment-queue'

const COLUMN_META: Record<OrderStatus, { label: string; icon: any; tone: string }> = {
  REQUESTED: { label: 'Requested', icon: ShoppingCart, tone: 'slate' },
  PAYMENT_PENDING_VERIFICATION: { label: 'Awaiting Payment', icon: AlertCircle, tone: 'amber' },
  PAYMENT_VERIFIED: { label: 'Ready to Pick Up', icon: Clock, tone: 'teal' },
  PICKED_UP: { label: 'Picked Up', icon: Truck, tone: 'blue' },
  AT_STATION: { label: 'At Station', icon: Package, tone: 'indigo' },
  PROCESSING: { label: 'Processing', icon: WashingMachine, tone: 'violet' },
  FINISHING: { label: 'Finishing', icon: Wind, tone: 'purple' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', icon: Truck, tone: 'cyan' },
  DELIVERED: { label: 'Delivered', icon: Home, tone: 'emerald' },
  CANCELLED: { label: 'Cancelled', icon: AlertCircle, tone: 'rose' },
}

// Phase 32: the active pipeline — everything EXCEPT the terminal Delivered
// stage. Completed cycles (requested → delivered) are off the board by
// default (client directive: "get rid of completed cycles"); a toggle brings
// the Delivered column back when the team wants to see today's finishes.
const ACTIVE_COLUMNS: OrderStatus[] = KANBAN_COLUMNS.filter((c) => c !== 'DELIVERED')

export function KanbanBoard({ isAdmin = false }: { isAdmin?: boolean }) {
  // Live mode (phase 25): the board polls every few seconds (paused while
  // the tab is hidden) and refetches the moment the tab regains focus —
  // new bookings, payment verifications and status changes made anywhere
  // (portal, another admin, a rider) appear on the board without a manual
  // refresh. Mutations still patch the cache instantly for the actor.
  const { data: ordersData, isLoading, hasMore, loadMore, isFetchingMore } = useOrders({
    refetchInterval: ADMIN_POLL.fast,
    refetchOnWindowFocus: true,
  })
  const updateOrderMutation = useUpdateOrder()
  const [activeId, setActiveId] = useState<string | null>(null)
  // Store only the ID — the LIVE order object is derived from the React
  // Query data below. Holding the object itself (the old bug) froze the
  // modal at its click-time snapshot: verifying a payment moved the card
  // but the open modal's progress bar, badges and dropdown never caught up.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  // Phase 32: completed (Delivered) orders are hidden until toggled on —
  // the board shows the LIVE pipeline, not history.
  const [showCompleted, setShowCompleted] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const orders = ordersData ?? []
  const boardColumns = showCompleted ? KANBAN_COLUMNS : ACTIVE_COLUMNS
  const completedCount = orders.filter((o: any) => o.status === 'DELIVERED').length
  const visibleOrders = orders.filter((o: any) =>
    boardColumns.includes(o.status)
  )
  // The LIVE order behind the open modal — re-derived on every render, so
  // cache patches from verify/reject/status mutations land here instantly.
  const selected = selectedId ? orders.find((o) => o.id === selectedId) : undefined

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const newStatus = over.id as OrderStatus
    const orderId = active.id as string
    if (KANBAN_COLUMNS.includes(newStatus)) {
      updateOrderMutation.mutate({ id: orderId, status: newStatus })
    }
  }

  const activeOrder = activeId
    ? orders.find((o) => o.id === activeId)
    : null

  // Phase 32 (admin only): how many orders on the board carry odd-movement
  // flags. Staff never receive anomaly data from any API, so this is 0 for
  // them — but the render is also explicitly role-gated as defence in depth.
  const flaggedCount = isAdmin
    ? visibleOrders.filter((o: any) => (o.anomalies ?? []).length > 0).length
    : 0

  return (
    // Phase 32 layout fix: heights now match the fixed sidebar geometry —
    // desktop: viewport minus the console header (3.5rem); mobile: viewport
    // minus the tab bar (~3rem). The old 7/9rem offsets accounted for the
    // removed site navbar and left dead space.
    <div className="flex h-[calc(100vh-3rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg font-semibold tracking-tight text-navy">
                Orders
              </h1>
              <LiveBadge />
              {isAdmin && flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                  <Shield className="h-3 w-3" /> {flaggedCount} flagged
                </span>
              )}
            </div>
            <p className="text-xs text-navy-300">
              {view === 'kanban'
                ? showCompleted
                  ? 'Showing the full pipeline including delivered orders — drag cards to update stages.'
                  : 'Drag order cards between columns to update their pipeline stage — the board updates itself live. Completed cycles are hidden by default.'
                : 'Sortable list of all orders. Click any row to view details — the list updates itself live.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Phase 32: completed cycles stay off the active board; this
                toggle reveals the Delivered column when wanted. */}
            {view === 'kanban' && (
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                  showCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-linen-200 text-navy-300 hover:text-navy'
                )}
              >
                <Home className="h-3.5 w-3.5" />
                {showCompleted ? `Delivered shown (${completedCount})` : `Completed (${completedCount})`}
              </button>
            )}
            <div className="flex items-center gap-1 rounded-full bg-linen-200 p-1">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                  view === 'kanban'
                    ? 'bg-navy text-white'
                    : 'text-navy-300 hover:text-navy'
                )}
              >
                <KanbanSquare className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                  view === 'list'
                    ? 'bg-navy text-white'
                    : 'text-navy-300 hover:text-navy'
                )}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
            {/* Orders are cursor-paginated — pull in the next page on demand */}
            {hasMore && (
              <button
                onClick={() => loadMore()}
                disabled={isFetchingMore}
                className="rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy transition hover:border-gold-300 disabled:opacity-50"
              >
                {isFetchingMore ? 'Loading…' : `Load more (${orders?.length ?? 0} loaded)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {view === 'list' && (
        <OrdersListView
          orders={visibleOrders}
          isAdmin={isAdmin}
          onOpen={(o) => setSelectedId(o.id)}
        />
      )}

      {view === 'kanban' && (
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto p-3 sm:p-4">
          {boardColumns.map((col) => {
            const meta = COLUMN_META[col]
            const colOrders = visibleOrders.filter((o) => o.status === col)
            return (
              <KanbanColumn
                key={col}
                status={col}
                label={meta.label}
                icon={meta.icon}
                tone={meta.tone}
                count={colOrders.length}
                onOpen={(o) => setSelectedId(o.id)}
              >
                {colOrders.map((o) => (
                  <OrderCard key={o.id} order={o} isAdmin={isAdmin} onOpen={() => setSelectedId(o.id)} />
                ))}
              </KanbanColumn>
            )
          })}
        </div>
        <DragOverlay>
          {activeOrder ? (
            <div className="rotate-2 opacity-90">
              <OrderCard order={activeOrder} isAdmin={isAdmin} onOpen={() => {}} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  )
}

function KanbanColumn({
  status,
  label,
  icon: Icon,
  tone,
  count,
  children,
  onOpen,
}: {
  status: OrderStatus
  label: string
  icon: any
  tone: string
  count: number
  children: React.ReactNode
  onOpen: (o: Order) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-linen-200 ring-1 transition',
        isOver ? 'ring-2 ring-gold-400 bg-gold-50/40' : 'ring-muted-foreground/15'
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              toneBg(tone)
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-navy">{label}</span>
        </div>
        <Badge variant="outline" className="rounded-full text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </div>
  )
}

function OrderCard({
  order,
  isAdmin,
  onOpen,
  dragging,
}: {
  order: any
  isAdmin?: boolean
  onOpen: () => void
  dragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  })
  // users + payments come from the order's nested includes (API already returns them)
  const customer = order.user
  const driver = order.driver
  const payments = order.payments ?? []
  const pendingPayment = payments.find((p) => p.status === 'PENDING')
  const rejectedTransfer = payments.find(
    (p) => p.status === 'REJECTED' && p.method === 'BANK_TRANSFER'
  )
  // Phase 32 — odd-movement flags (ADMIN only; staff data never includes
  // anomalies from the API, and this render check is defence in depth).
  const anomalies: any[] = isAdmin ? order.anomalies ?? [] : []

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Open on click only if not dragging
        if (!isDragging) {
          e.stopPropagation()
          onOpen()
        }
      }}
      className={cn(
        'cursor-grab border-navy-100 bg-white shadow-sm transition hover:border-gold-300 hover:shadow-md active:cursor-grabbing',
        dragging && 'shadow-lg',
        isDragging && 'opacity-50'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs font-semibold text-navy">
                #{order.orderNumber}
              </p>
              {anomalies.length > 0 && (
                <span
                  title={anomalies.map((a) => a.detail || a.kind).join('\n')}
                  className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700"
                >
                  <Shield className="h-2.5 w-2.5" /> {anomalies.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-navy-300">
              {customer?.name ?? '—'}
            </p>
          </div>
          {order.type === 'KG' ? (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
          ) : (
            <User className="h-3.5 w-3.5 shrink-0 text-gold-400" />
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-navy-300">
          <Clock className="h-3 w-3" />
          {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
        </div>

        {order.serviceSpeed && order.serviceSpeed !== 'STANDARD' && (
          <div className="mt-1.5 flex w-fit items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            <Zap className="h-3 w-3" />
            {order.serviceSpeed === 'EXPRESS_24' ? 'Express 24' : 'Express 48'}
          </div>
        )}

        <div className="mt-1 truncate text-[10px] text-navy-300">
          {order.pickupAddress}
        </div>

        {order.totalPrice !== undefined ? (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-navy-300">
              {order.finalWeight ? `${order.finalWeight}kg` : (() => {
                try { return `${JSON.parse(order.itemsManifest || '[]').length} items` } catch { return 'items' }
              })()}
            </span>
            <span className="font-bold text-navy">{formatNaira(order.totalPrice)}</span>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="mt-2 rounded-full border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
          >
            Pending weighing
          </Badge>
        )}

        {order.guaranteeActive && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-navy-300">
            <Shield className="h-3 w-3" /> Guarantee active
          </div>
        )}

        {pendingPayment && (
          <div className="mt-2 rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">
            ⚠ Receipt uploaded · needs verification
          </div>
        )}

        {rejectedTransfer && (
          <div className="mt-2 rounded bg-rose-100 px-2 py-1 text-[10px] font-medium text-rose-800">
            Transfer rejected — customer emailed
          </div>
        )}

        {driver && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-navy-300">
            <Truck className="h-3 w-3" /> {driver.name}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function toneBg(tone: string): string {
  switch (tone) {
    case 'amber':
      return 'bg-amber-100 text-amber-700'
    case 'teal':
      return 'bg-teal-100 text-teal-700'
    case 'blue':
      return 'bg-blue-100 text-blue-700'
    case 'indigo':
      return 'bg-indigo-100 text-indigo-700'
    case 'violet':
      return 'bg-violet-100 text-violet-700'
    case 'purple':
      return 'bg-purple-100 text-purple-700'
    case 'cyan':
      return 'bg-cyan-100 text-cyan-700'
    case 'emerald':
      return 'bg-gold-100 text-navy'
    case 'rose':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

// =====================================================
// ORDERS LIST VIEW — sortable table alternative to Kanban
// =====================================================
function OrdersListView({
  orders,
  isAdmin,
  onOpen,
}: {
  orders: any[]
  isAdmin?: boolean
  onOpen: (o: any) => void
}) {
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'amount' | 'status'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Phase 32: 'ACTIVE' (the live pipeline — completed cycles hidden) is the
  // default, matching the kanban's behaviour. 'ALL' brings history back.
  const [filter, setFilter] = useState<'ACTIVE' | OrderStatus | 'ALL'>('ACTIVE')

  const filtered =
    filter === 'ALL'
      ? orders
      : filter === 'ACTIVE'
        ? orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
        : orders.filter((o) => o.status === filter)
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    else if (sortBy === 'number') cmp = a.orderNumber.localeCompare(b.orderNumber)
    else if (sortBy === 'amount') cmp = (a.totalPrice ?? 0) - (b.totalPrice ?? 0)
    else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const statusFilters: Array<'ACTIVE' | OrderStatus | 'ALL'> = [
    'ACTIVE',
    ...KANBAN_COLUMNS,
    'ALL',
  ]
  const labelFor = (s: 'ACTIVE' | OrderStatus | 'ALL') =>
    s === 'ACTIVE' ? 'Active' : s === 'ALL' ? 'All' : COLUMN_META[s as OrderStatus]?.label ?? s
  const countFor = (s: 'ACTIVE' | OrderStatus | 'ALL') =>
    s === 'ALL'
      ? orders.length
      : s === 'ACTIVE'
        ? orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length
        : orders.filter((o) => o.status === s).length

  return (
    <div className="flex-1 overflow-y-auto bg-linen-200 p-4">
      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {statusFilters.map((s) => {
          const active = filter === s
          const label = labelFor(s)
          const count = countFor(s)
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition',
                active
                  ? 'bg-navy text-white'
                  : 'bg-white text-navy-300 hover:text-navy'
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0 text-[10px]',
                  active ? 'bg-white/20' : 'bg-linen-200'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Orders table */}
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-navy">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-linen-100 text-left text-xs uppercase tracking-wide text-navy-300">
              <tr>
                <th className="px-4 py-3">
                  <button onClick={() => toggleSort('number')} className="flex items-center gap-1 font-semibold">
                    Order #
                    {sortBy === 'number' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="hidden px-4 py-3 md:table-cell">Customer</th>
                <th className="hidden px-4 py-3 lg:table-cell">Type</th>
                <th className="px-4 py-3">
                  <button onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold">
                    Status
                    {sortBy === 'status' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="hidden px-4 py-3 lg:table-cell">
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 font-semibold">
                    Date
                    {sortBy === 'date' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 font-semibold">
                    Amount
                    {sortBy === 'amount' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const customer = o.user
                const meta = COLUMN_META[o.status]
                // Odd-movement flags — admin only (staff payloads carry none)
                const anomalies: any[] = isAdmin ? o.anomalies ?? [] : []
                return (
                  <tr
                    key={o.id}
                    onClick={() => onOpen(o)}
                    className="cursor-pointer border-b border-navy-50 transition last:border-0 hover:bg-linen-50"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-navy">
                          #{o.orderNumber}
                        </span>
                        {o.guaranteeActive && (
                          <Shield className="inline h-3 w-3 text-gold-400" />
                        )}
                        {anomalies.length > 0 && (
                          <span
                            title={anomalies.map((a) => a.detail || a.kind).join('\n')}
                            className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700"
                          >
                            <Shield className="h-2.5 w-2.5" /> {anomalies.length}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="flex items-center gap-2 text-navy">
                        {o.type === 'ITEM' ? (
                          <User className="h-3.5 w-3.5 text-navy-300" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-navy-300" />
                        )}
                        <span className="truncate">{customer?.name ?? '—'}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="text-xs text-navy-300">
                        {o.type === 'ITEM' ? 'Retail' : 'Corporate'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          toneBg(meta.tone)
                        )}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-navy-300 lg:table-cell">
                      {formatDate(o.pickupDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">
                      {o.totalPrice !== undefined ? formatNaira(o.totalPrice) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="h-3.5 w-3.5 text-navy-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="p-10 text-center text-sm text-navy-300">
            No orders match this filter.
          </div>
        )}
      </div>
    </div>
  )
}
