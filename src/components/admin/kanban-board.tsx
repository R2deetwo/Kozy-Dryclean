'use client'

import { useState } from 'react'
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
  List,
  KanbanSquare,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useMemo } from 'react'
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

export function KanbanBoard() {
  const orders = useStore((s) => s.orders)
  const updateStatus = useStore((s) => s.updateOrderStatus)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Order | undefined>(undefined)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const visibleOrders = orders.filter((o) =>
    KANBAN_COLUMNS.includes(o.status)
  )

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
      updateStatus(orderId, newStatus, 'u-admin')
    }
  }

  const activeOrder = activeId
    ? orders.find((o) => o.id === activeId)
    : null

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-9rem)]">
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight text-navy">
              Orders
            </h1>
            <p className="text-xs text-navy-300">
              {view === 'kanban'
                ? 'Drag order cards between columns to update their pipeline stage.'
                : 'Sortable list of all orders. Click any row to view details.'}
            </p>
          </div>
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
        </div>
      </div>

      {view === 'list' && (
        <OrdersListView
          orders={visibleOrders}
          onOpen={(o) => setSelected(o)}
        />
      )}

      {view === 'kanban' && (
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto p-3 sm:p-4">
          {KANBAN_COLUMNS.map((col) => {
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
                onOpen={(o) => setSelected(o)}
              >
                {colOrders.map((o) => (
                  <OrderCard key={o.id} order={o} onOpen={() => setSelected(o)} />
                ))}
              </KanbanColumn>
            )
          })}
        </div>
        <DragOverlay>
          {activeOrder ? (
            <div className="rotate-2 opacity-90">
              <OrderCard order={activeOrder} onOpen={() => {}} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => setSelected(undefined)}
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
        'flex w-72 shrink-0 flex-col rounded-xl bg-linen-200 dark:bg-navy-700 ring-1 transition',
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
          <span className="text-sm font-semibold text-navy dark:text-white">{label}</span>
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
  onOpen,
  dragging,
}: {
  order: Order
  onOpen: () => void
  dragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  })
  const users = useStore((s) => s.users)
  const customer = users.find((u) => u.id === order.userId)
  const driver = users.find((u) => u.id === order.driverId)
  const allPayments = useStore((s) => s.payments)
  const payments = useMemo(
    () => allPayments.filter((p) => p.orderId === order.id),
    [allPayments, order.id]
  )
  const pendingPayment = payments.find((p) => p.status === 'PENDING')

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
        'cursor-grab border-navy-100 dark:border-navy-600 bg-white shadow-sm transition hover:border-gold-300 hover:shadow-md active:cursor-grabbing',
        dragging && 'shadow-lg',
        isDragging && 'opacity-50'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-semibold text-navy dark:text-white">
              #{order.orderNumber}
            </p>
            <p className="mt-0.5 truncate text-xs text-navy-300 dark:text-navy-200">
              {customer?.name ?? '—'}
            </p>
          </div>
          {order.type === 'CORPORATE' ? (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
          ) : (
            <User className="h-3.5 w-3.5 shrink-0 text-gold-400" />
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-navy-300 dark:text-navy-200">
          <Clock className="h-3 w-3" />
          {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
        </div>

        <div className="mt-1 truncate text-[10px] text-navy-300 dark:text-navy-200">
          {order.pickupAddress}
        </div>

        {order.totalPrice !== undefined ? (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-navy-300 dark:text-navy-200">
              {order.finalWeight ? `${order.finalWeight}kg` : `${order.items.length} item${order.items.length === 1 ? '' : 's'}`}
            </span>
            <span className="font-bold text-navy dark:text-white">{formatNaira(order.totalPrice)}</span>
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

        {driver && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-navy-300 dark:text-navy-200">
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
  onOpen,
}: {
  orders: Order[]
  onOpen: (o: Order) => void
}) {
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'amount' | 'status'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL')

  const filtered = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)
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

  const statusFilters: Array<OrderStatus | 'ALL'> = ['ALL', ...KANBAN_COLUMNS]

  return (
    <div className="flex-1 overflow-y-auto bg-linen-200 p-4">
      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {statusFilters.map((s) => {
          const active = filter === s
          const label = s === 'ALL' ? 'All' : COLUMN_META[s as OrderStatus]?.label ?? s
          const count = s === 'ALL' ? orders.length : orders.filter((o) => o.status === s).length
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
                const customer = useStore.getState().users.find((u) => u.id === o.userId)
                const meta = COLUMN_META[o.status]
                return (
                  <tr
                    key={o.id}
                    onClick={() => onOpen(o)}
                    className="cursor-pointer border-b border-navy-50 transition last:border-0 hover:bg-linen-50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-navy">
                        #{o.orderNumber}
                      </span>
                      {o.guaranteeActive && (
                        <Shield className="ml-1 inline h-3 w-3 text-gold-400" />
                      )}
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
