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
} from 'lucide-react'
import { useUsers, useOrders } from '@/lib/hooks'
import { useMemo } from 'react'
import { formatNaira, formatDate } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function CustomersView() {
  const { data: users } = useUsers()
  const { data: orders } = useOrders()
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
        <h1 className="text-lg font-bold tracking-tight text-navy dark:text-white">Customers (CRM)</h1>
        <p className="text-xs text-navy-300 dark:text-navy-200">
          Browse all clients, riders, and admin accounts.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300 dark:text-navy-200" />
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
          <thead className="bg-linen-200 dark:bg-navy-700 text-left text-xs uppercase tracking-wide text-navy-300 dark:text-navy-200">
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
              return (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="cursor-pointer border-b transition last:border-0 hover:bg-linen-200 dark:bg-navy-700"
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
                        <p className="truncate font-medium text-navy dark:text-white">{u.name}</p>
                        <p className="truncate text-xs text-navy-300 dark:text-navy-200">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <p className="text-xs text-navy dark:text-white">{u.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-navy dark:text-white">{userOrders.length}</span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="font-semibold text-navy-300">{formatNaira(ltv)}</span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell text-xs text-navy-300 dark:text-navy-200">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-navy-300 dark:text-navy-200">
            No customers match your search.
          </div>
        )}
      </div>

      {selected && (
        <CustomerDetailModal user={selected} onClose={() => setSelected(undefined)} />
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

function CustomerDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  const allOrders = useOrders().data ?? []
  const orders = useMemo(
    () => allOrders.filter((o) => o.userId === user.id),
    [allOrders, user.id]
  )
  const ltv = orders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const activeCount = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.name}
            <RoleBadge role={user.role} />
          </DialogTitle>
          <DialogDescription>
            Joined {formatDate(user.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-navy-100 dark:border-navy-600">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300 dark:text-navy-200">Total orders</p>
                <p className="text-2xl font-bold text-navy dark:text-white">{orders.length}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100 dark:border-navy-600">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300 dark:text-navy-200">Active</p>
                <p className="text-2xl font-bold text-navy dark:text-white">{activeCount}</p>
              </CardContent>
            </Card>
            <Card className="border-navy-100 dark:border-navy-600">
              <CardContent className="p-4">
                <p className="text-xs text-navy-300 dark:text-navy-200">Total spent</p>
                <p className="text-xl font-bold text-navy-300">{formatNaira(ltv)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                <Mail className="h-3.5 w-3.5" /> Email
              </p>
              <p className="mt-1 text-navy-300 dark:text-navy-200">{user.email}</p>
            </div>
            <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                <Phone className="h-3.5 w-3.5" /> Phone
              </p>
              <p className="mt-1 text-navy-300 dark:text-navy-200">{user.phone}</p>
            </div>
            {user.address && (
              <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm sm:col-span-2">
                <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                  <MapPin className="h-3.5 w-3.5" /> Address
                </p>
                <p className="mt-1 text-navy-300 dark:text-navy-200">{user.address}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">Order history</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-navy-300 dark:text-navy-200">No orders yet.</p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-navy dark:text-white">
                        #{o.orderNumber}
                      </p>
                      <p className="text-xs text-navy-300 dark:text-navy-200">
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
                        <span className="font-semibold text-navy dark:text-white">
                          {formatNaira(o.totalPrice)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
