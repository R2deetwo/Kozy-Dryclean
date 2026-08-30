'use client'

import { useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts'
import { useOrders, usePayments } from '@/lib/hooks'
import { formatNaira, formatDateTime, type Order } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function FinanceView() {
  // fetchAll: finance totals/revenue charts must see every order/payment —
  // the hooks page through the cursor API (bounded by MAX_PAGES).
  const { data: orders } = useOrders({ fetchAll: true })
  const { data: payments } = usePayments({ fetchAll: true })

  const stats = useMemo(() => {
    const verified = (payments ?? []).filter((p: any) => p.status === 'VERIFIED')
    const pending = (payments ?? []).filter((p: any) => p.status === 'PENDING')
    const rejected = (payments ?? []).filter((p: any) => p.status === 'REJECTED')

    const totalRevenue = verified.reduce((s, p) => s + p.amount, 0)
    const expectedRevenue = (orders ?? [])
      .filter((o: any) => o.totalPrice !== undefined)
      .reduce((s, o) => s + (o.totalPrice ?? 0), 0)
    const pendingAmount = pending.reduce((s, p) => s + p.amount, 0)
    const b2bRevenue = (orders ?? [])
      .filter((o: any) => o.type === 'KG' && o.status === 'DELIVERED')
      .reduce((s, o) => s + (o.totalPrice ?? 0), 0)
    const b2cRevenue = (orders ?? [])
      .filter((o: any) => o.type === 'ITEM' && o.status === 'DELIVERED')
      .reduce((s, o) => s + (o.totalPrice ?? 0), 0)

    return {
      verified,
      pending,
      rejected,
      totalRevenue,
      expectedRevenue,
      pendingAmount,
      b2bRevenue,
      b2cRevenue,
    }
  }, [payments, orders])

  // Build revenue-per-day series (last 7 days from latest order)
  const revenueByDay = useMemo(() => {
    const today = new Date()
    const days: { date: string; label: string; revenue: number; pending: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-NG', { weekday: 'short' })
      const revenue = (orders ?? [])
        .filter((o: any) => o.createdAt.slice(0, 10) === iso && o.totalPrice !== undefined)
        .reduce((s, o) => s + (o.totalPrice ?? 0), 0)
      const pending = (orders ?? [])
        .filter(
          (o) =>
            o.createdAt.slice(0, 10) === iso &&
            o.totalPrice !== undefined &&
            !['DELIVERED', 'CANCELLED'].includes(o.status)
        )
        .reduce((s, o) => s + (o.totalPrice ?? 0), 0)
      days.push({ date: iso, label, revenue, pending })
    }
    return days
  }, [orders])

  // Payment method breakdown
  const methodStats = useMemo(() => {
    const transfer = (payments ?? [])
      .filter((p: any) => p.method === 'BANK_TRANSFER' && p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amount, 0)
    const paystack = (payments ?? [])
      .filter((p: any) => p.method === 'PAYSTACK' && p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amount, 0)
    return [
      { name: 'Bank Transfer', value: transfer, color: '#10b981' },
      { name: 'Paystack', value: paystack, color: '#3b82f6' },
    ]
  }, [payments])

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-navy">Finances</h1>
        <p className="text-xs text-navy-300">
          Track revenue, payment verifications, and outstanding balances.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Collected revenue"
          value={formatNaira(stats.totalRevenue)}
          delta={`${stats.verified.length} verified payment${stats.verified.length === 1 ? '' : 's'}`}
          icon={Wallet}
          tone="emerald"
        />
        <StatCard
          title="Pending verification"
          value={formatNaira(stats.pendingAmount)}
          delta={`${stats.pending.length} receipt${stats.pending.length === 1 ? '' : 's'}`}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          title="Corporate revenue"
          value={formatNaira(stats.b2bRevenue)}
          delta="Corporate clients"
          icon={TrendingUp}
          tone="indigo"
        />
        <StatCard
          title="Retail revenue"
          value={formatNaira(stats.b2cRevenue)}
          delta="Retail clients"
          icon={TrendingUp}
          tone="emerald"
        />
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Booked order value (last 7 days)</CardTitle>
            <p className="text-[11px] font-normal text-navy-300">
              Value of orders placed per day (green) and the still-in-flight portion
              (amber). Money actually collected lives in the “Collected revenue” tiles —
              verified payments, not bookings.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByDay} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatNaira(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  fill="url(#rev)"
                  strokeWidth={2}
                  name="Booked"
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stroke="#f59e0b"
                  fill="url(#pend)"
                  strokeWidth={2}
                  name="Pending"
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={methodStats} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: number) => formatNaira(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {methodStats.map((m, i) => (
                    <Cell key={i} fill={m.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Transactions table */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-linen-200 text-left text-xs uppercase tracking-wide text-navy-300">
                <tr>
                  <th className="px-4 py-2">Order</th>
                  <th className="hidden px-4 py-2 md:table-cell">Method</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="hidden px-4 py-2 lg:table-cell">Date</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {((payments ?? []).slice(0, 10)).map((p: any) => {
                  const order = (orders ?? []).find((o: any) => o.id === p.orderId)
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-linen-200">
                      <td className="px-4 py-2 font-mono text-xs">
                        #{order?.orderNumber ?? '—'}
                      </td>
                      <td className="hidden px-4 py-2 md:table-cell">
                        <span className="flex items-center gap-1 text-xs text-navy-300">
                          {p.method === 'BANK_TRANSFER' ? (
                            <Banknote className="h-3 w-3" />
                          ) : (
                            <CreditCard className="h-3 w-3" />
                          )}
                          {p.method === 'BANK_TRANSFER' ? 'Transfer' : 'Paystack'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatNaira(p.amount)}
                      </td>
                      <td className="hidden px-4 py-2 text-xs text-navy-300 lg:table-cell">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        {p.status === 'VERIFIED' && (
                          <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                          </Badge>
                        )}
                        {p.status === 'PENDING' && (
                          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                            <Clock className="mr-1 h-3 w-3" /> Pending
                          </Badge>
                        )}
                        {p.status === 'REJECTED' && (
                          <Badge variant="outline" className="rounded-full border-rose-200 text-rose-700">
                            <XCircle className="mr-1 h-3 w-3" /> Rejected
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  tone = 'emerald',
}: {
  title: string
  value: string
  delta: string
  icon: any
  tone?: 'emerald' | 'amber' | 'indigo'
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'indigo'
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-gold-100 text-navy'
  return (
    <Card className="border-navy-100 shadow-navy">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-navy-300">
            {title}
          </span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-xl font-bold text-navy">{value}</p>
        <p className="mt-1 text-xs text-navy-300">{delta}</p>
      </CardContent>
    </Card>
  )
}
