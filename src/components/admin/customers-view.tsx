'use client'

import { useState } from 'react'
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  User as UserIcon,
  Truck,
  Calendar,
  Shield,
  ShoppingBag,
  PlusCircle,
  Trash2,
  AlertTriangle,
  MailCheck,
  MailX,
} from 'lucide-react'
import { useUsers, useOrders, useDeleteUser, ADMIN_POLL } from '@/lib/hooks'
import { useMemo } from 'react'
import { formatNaira, formatDate } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'

/** A customer counts as NEW for their first 7 days after signing up. */
const NEW_CUSTOMER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isNewCustomer(createdAt: string | Date): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_CUSTOMER_WINDOW_MS
}

export function CustomersView() {
  // Users are the primary list here → incremental paging with a "Load more"
  // control (orders joined per-row need the full set → fetchAll).
  // Live mode (phase 25): the CRM list polls itself — new signups appear
  // without a refresh.
  const { data: users, hasMore, loadMore, isFetchingMore } = useUsers({
    refetchInterval: ADMIN_POLL.slow,
    refetchOnWindowFocus: true,
  })
  const { data: orders } = useOrders({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'RETAIL' | 'CORPORATE' | 'DRIVER'>('all')
  const [selected, setSelected] = useState<any | undefined>(undefined)

  const filtered = (users ?? []).filter((u) => {
    if (filter !== 'all' && u.role !== filter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.phone.includes(s)
    )
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-navy">Customers (CRM)</h1>
        <p className="text-xs text-navy-300">
          Browse all clients, riders, and admin accounts. Recent signups are flagged
          <span className="mx-1 inline-flex items-center rounded-full bg-gold-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-navy">new</span>
          for their first week.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="B2C">Retail</TabsTrigger>
            <TabsTrigger value="B2B">Corporate</TabsTrigger>
            <TabsTrigger value="DRIVER">Drivers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-linen-200 text-left text-xs uppercase tracking-wide text-navy-300">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="hidden px-4 py-2 md:table-cell">Type</th>
              <th className="hidden px-4 py-2 lg:table-cell">Contact</th>
              <th className="px-4 py-2 text-center">Orders</th>
              <th className="hidden px-4 py-2 lg:table-cell">Total Spent</th>
              <th className="hidden px-4 py-2 sm:table-cell">Since</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const userOrders = (orders ?? []).filter((o) => o.userId === u.id)
              const ltv = userOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
              const isNew = isNewCustomer(u.createdAt)
              return (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={cn(
                    'cursor-pointer border-b transition last:border-0 hover:bg-linen-200',
                    isNew && 'bg-gold-50/60'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                          u.role === 'B2B'
                            ? 'bg-indigo-100 text-indigo-700'
                            : u.role === 'DRIVER'
                            ? 'bg-amber-100 text-amber-700'
                            : u.role === 'ADMIN'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-gold-100 text-navy'
                        )}
                      >
                        {u.role === 'B2B' ? (
                          <Building2 className="h-3.5 w-3.5" />
                        ) : u.role === 'DRIVER' ? (
                          <Truck className="h-3.5 w-3.5" />
                        ) : (
                          u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-navy">
                          {u.name}
                          {/* NEW badge — recent signups stand out so the owner
                              can personally welcome fresh customers (and spot
                              duplicate/junk entries fast). */}
                          {isNew && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-gold-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-navy">
                              new
                            </span>
                          )}
                          {/* Unverified email — the signup verification email
                              never landed (typically a typo). */}
                          {!u.emailVerified && (
                            <span
                              title="Email not verified — the verification email may never have arrived"
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-semibold text-rose-600 ring-1 ring-rose-200"
                            >
                              <MailX className="h-2.5 w-2.5" /> unverified
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-navy-300">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <p className="text-xs text-navy">{u.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy">{userOrders.length}</span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="font-semibold text-navy-300">{formatNaira(ltv)}</span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell text-xs text-navy-300">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-navy-300">
            No customers match your search.
          </div>
        )}
        {hasMore && (
          <div className="flex items-center justify-center gap-3 border-t bg-linen-100 px-4 py-3">
            <p className="text-xs text-navy-300">
              Showing {filtered.length} loaded — more records available.
            </p>
            <button
              onClick={() => loadMore()}
              disabled={isFetchingMore}
              className="rounded-full border border-navy-200 px-4 py-1.5 text-xs font-semibold text-navy transition hover:border-gold-300 hover:text-navy disabled:opacity-50"
            >
              {isFetchingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <CustomerDetailModal
          user={selected}
          orderCount={(orders ?? []).filter((o) => o.userId === selected.id).length}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: any }) {
  if (role === 'ADMIN') {
    return <Badge className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">Admin</Badge>
  }
  if (role === 'DRIVER') {
    return <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">Driver</Badge>
  }
  if (role === 'B2B') {
    return <Badge className="rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Corporate</Badge>
  }
  return <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">Retail</Badge>
}

function CustomerDetailModal({
  user,
  orderCount,
  onClose,
}: {
  user: any
  orderCount: number
  onClose: () => void
}) {
  // fetchAll: the modal computes this customer's LTV/order counts over the
  // whole order history, not just the first page.
  const allOrders = useOrders({ fetchAll: true }).data ?? []
  const orders = useMemo(
    () => allOrders.filter((o) => o.userId === user.id),
    [allOrders, user.id]
  )
  const ltv = orders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const activeCount = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length
  const reviewCount = 0 // reviews ride along with orders server-side; shown via the warning copy

  // ----- Delete flow -----
  const deleteMutation = useDeleteUser()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const handleDelete = () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return
    deleteMutation.mutate(
      { id: user.id, confirm: 'DELETE' },
      {
        onSuccess: (data) => {
          toast({
            title: 'Customer deleted',
            description: `${user.name} and ${data.deleted.orders} order${
              data.deleted.orders === 1 ? '' : 's'
            } were permanently removed.`,
            variant: 'destructive',
          })
          setConfirmOpen(false)
          onClose()
        },
        onError: (e: any) =>
          toast({
            title: 'Deletion failed',
            description: e?.message || 'Nothing was removed — please try again.',
            variant: 'destructive',
          }),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.name}
            <RoleBadge role={user.role} />
            {isNewCustomer(user.createdAt) && (
              <span className="inline-flex items-center rounded-full bg-gold-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-navy">
                new
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Joined {formatDate(user.createdAt)}
            {!user.emailVerified && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200">
                <MailX className="h-2.5 w-2.5" /> email unverified
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Total orders</p>
                <p className="text-2xl font-bold text-navy">{orders.length}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Active</p>
                <p className="text-2xl font-bold text-navy">{activeCount}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300">Total spent</p>
                <p className="text-xl font-bold text-navy-300">{formatNaira(ltv)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <Mail className="h-3.5 w-3.5" /> Email
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-navy-300">
                {user.email}
                {user.emailVerified ? (
                  <MailCheck className="h-3 w-3 text-emerald-600" aria-label="verified" />
                ) : (
                  <MailX className="h-3 w-3 text-rose-500" aria-label="unverified" />
                )}
              </p>
            </div>
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <Phone className="h-3.5 w-3.5" /> Phone
              </p>
              <p className="mt-1 text-navy-300">{user.phone}</p>
            </div>
            {user.address && (
              <div className="rounded-lg bg-linen-200 p-3 text-sm sm:col-span-2">
                <p className="flex items-center gap-1.5 font-medium text-navy">
                  <MapPin className="h-3.5 w-3.5" /> Address
                </p>
                <p className="mt-1 text-navy-300">{user.address}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Order history</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-navy-300">No orders yet.</p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-navy">
                        #{o.orderNumber}
                      </p>
                      <p className="text-xs text-navy-300">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {formatDate(o.pickupDate)} ·{' '}
                        {o.type === 'ITEM' ? (() => { try { return JSON.parse(o.itemsManifest || '[]').length + ' items' } catch { return 'items' } })() : 'Bulk'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.guaranteeActive && (
                        <Shield className="h-3.5 w-3.5 text-gold-400" />
                      )}
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {o.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      {o.totalPrice !== null && o.totalPrice !== undefined && (
                        <span className="font-semibold text-navy">
                          {formatNaira(o.totalPrice)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ----- Danger zone (client-requested): permanent deletion ----- */}
          {user.role !== 'ADMIN' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                <AlertTriangle className="h-4 w-4" /> Danger zone
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                Permanently delete this customer — for duplicate or junk entries (e.g. a
                re-registration after a mistyped email). This removes{' '}
                <strong>their entire history</strong>: {orders.length} order
                {orders.length === 1 ? '' : 's'}, payment records, receipts, reviews and
                all stats attached to them. <strong>It cannot be undone.</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConfirmOpen(true); setConfirmText('') }}
                className="mt-3 border-rose-300 text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete customer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Second-guess dialog: type DELETE to unlock the button. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="h-5 w-5" /> Delete {user.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              This will <strong>permanently erase</strong> {user.name} ({user.email}) along
              with <strong>all {orders.length} of their order{orders.length === 1 ? '' : 's'}</strong>,
              payment records and receipts, reviews, and every stat attached to this
              account. <strong>This action cannot be undone or recovered.</strong>
              <br />
              <br />
              If this entry is a duplicate (the customer re-registered), make sure you are
              deleting the wrong one — not the account with the real order history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-xs font-medium text-navy-300">
              Type <span className="font-mono font-bold text-rose-700">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deleteMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
