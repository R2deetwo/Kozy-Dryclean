'use client'

// =============================================================================
// NotificationsView — the REAL operations feed (phase 24)
// =============================================================================
// Every admin alert (new signup, new order, customer-says-they've-paid,
// feedback, rider application, test send) lands here the moment it happens,
// together with the per-recipient EMAIL DELIVERY result. This is the owner's
// guarantee that signups and payment confirmations can never be missed
// again — even when an alert email is filtered to spam, the event and its
// delivery status are right here.
//
// (History: an earlier "Notifications" tab was removed in the phase-23 audit
// because it displayed fabricated data. This one is backed by the
// NotificationEvent table written by the live alert pipeline.)
// =============================================================================

import { useState } from 'react'
import {
  UserPlus,
  ShoppingBag,
  Receipt,
  MessageSquareHeart,
  Bike,
  FlaskConical,
  MailCheck,
  MailX,
  MailQuestion,
  CheckCheck,
  Inbox,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDateTime, type NotificationEvent as NotificationEventType } from '@/lib/types'
import { useNotificationEvents, useMarkNotificationsRead } from '@/lib/hooks'

type Event = NotificationEventType & { linkTab?: string }

const TYPE_META: Record<
  string,
  { label: string; icon: any; cls: string; link?: { label: string; tab: string } }
> = {
  NEW_SIGNUP: {
    label: 'New signup',
    icon: UserPlus,
    cls: 'bg-emerald-100 text-emerald-800',
    link: { label: 'Open CRM', tab: 'customers' },
  },
  NEW_ORDER: {
    label: 'New order',
    icon: ShoppingBag,
    cls: 'bg-blue-100 text-blue-800',
    link: { label: 'Open Orders board', tab: 'kanban' },
  },
  TRANSFER_PENDING: {
    label: 'Payment to verify',
    icon: Receipt,
    cls: 'bg-gold-100 text-gold-800',
    link: { label: 'Open payment queue', tab: 'payments' },
  },
  FEEDBACK: {
    label: 'Feedback',
    icon: MessageSquareHeart,
    cls: 'bg-purple-100 text-purple-800',
    link: { label: 'Open Feedback inbox', tab: 'feedback' },
  },
  RIDER_APPLICATION: {
    label: 'Rider application',
    icon: Bike,
    cls: 'bg-sky-100 text-sky-800',
  },
  TEST: {
    label: 'Test',
    icon: FlaskConical,
    cls: 'bg-slate-100 text-slate-700',
  },
}

const EMAIL_STATUS_META: Record<string, { label: string; icon: any; cls: string; hint: string }> = {
  SENT: {
    label: 'Emails sent',
    icon: MailCheck,
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    hint: 'Delivered to the email provider for every recipient',
  },
  PARTIAL: {
    label: 'Some emails failed',
    icon: MailX,
    cls: 'bg-amber-50 text-amber-800 border border-amber-200',
    hint: 'At least one recipient was accepted, at least one failed',
  },
  FAILED: {
    label: 'Emails failed',
    icon: MailX,
    cls: 'bg-red-50 text-red-700 border border-red-200',
    hint: 'The email provider rejected the send — check recipients in Settings',
  },
  DISABLED: {
    label: 'Emails off',
    icon: MailQuestion,
    cls: 'bg-slate-50 text-slate-600 border border-slate-200',
    hint: 'This alert type is switched off in Settings → Notifications',
  },
  NONE: {
    label: 'No email attempted',
    icon: MailQuestion,
    cls: 'bg-slate-50 text-slate-600 border border-slate-200',
    hint: '',
  },
}

function recipientsOf(e: Event): string[] {
  try {
    const r = e.recipients ? JSON.parse(e.recipients) : []
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

export function NotificationsView({ onGoto }: { onGoto?: (tab: string) => void }) {
  const { data, isLoading } = useNotificationEvents()
  const markRead = useMarkNotificationsRead()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const events = (data?.events ?? []) as Event[]
  const unread = data?.unread ?? 0
  const shown = filter === 'unread' ? events.filter((e) => !e.readAt) : events

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-navy">Notifications</h2>
          <p className="text-xs text-navy-300">
            Every signup, order, payment confirmation and message — the instant it happens, with
            the email delivery result for each recipient. This feed is written by the same
            pipeline that sends your alert emails, so it never misses an event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
          >
            {filter === 'all' ? `Show unread only (${unread})` : 'Show all'}
          </Button>
          <Button
            size="sm"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-navy-300">Loading notifications…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border bg-white py-12 text-center shadow-sm">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-navy-200" />
          <p className="text-sm font-medium text-navy">
            {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          </p>
          <p className="mt-1 text-xs text-navy-300">
            New signups, orders, payment confirmations, feedback and rider applications will
            appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => {
            const meta = TYPE_META[e.type] ?? TYPE_META.TEST
            const Icon = meta.icon
            const mail = EMAIL_STATUS_META[e.emailStatus] ?? EMAIL_STATUS_META.NONE
            const MailIcon = mail.icon
            const recipients = recipientsOf(e)
            const isUnread = !e.readAt
            return (
              <li
                key={e.id}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition',
                  isUnread ? 'border-gold-300 bg-gold-50/40' : 'border-navy-100'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5 rounded-lg p-2', meta.cls)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-navy">{e.title}</p>
                      {isUnread && <Badge className="bg-gold-400 text-[10px] text-navy">NEW</Badge>}
                    </div>
                    <p className="mt-0.5 break-words text-sm text-navy-300">{e.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        title={
                          recipients.length > 0
                            ? `Alert emailed to: ${recipients.join(', ')}`
                            : mail.hint
                        }
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          mail.cls
                        )}
                      >
                        <MailIcon className="h-3 w-3" /> {mail.label}
                        {recipients.length > 0 && ` · ${recipients.length}`}
                      </span>
                      <span className="text-[11px] text-navy-300">
                        {formatDateTime(e.createdAt)}
                      </span>
                      {onGoto && meta.link && (
                        <button
                          onClick={() => onGoto(meta.link!.tab)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy underline-offset-2 hover:underline"
                        >
                          {meta.link.label} <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => markRead.mutate({ ids: [e.id] })}
                          className="text-[11px] font-semibold text-navy-300 hover:text-navy"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
