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
        <h1 className="font-serif text-lg font-semibold tracking-tight text-navy">
          Orders Kanban
        </h1>
        <p className="text-xs text-navy-300">
          Drag order cards between columns to update their pipeline stage.
        </p>
      </div>

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
          {order.type === 'B2B' ? (
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
