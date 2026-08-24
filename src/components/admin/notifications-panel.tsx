'use client'

import { Bell, MessageSquare, Mail, Smartphone } from 'lucide-react'
import { useStore } from '@/lib/store'
import { formatDateTime } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function NotificationsPanel() {
  const notifications = useStore((s) => s.notifications)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-foreground">Notifications log</h1>
        <p className="text-xs text-muted-foreground">
          Audit trail of SMS, email, and in-app notifications dispatched across the pipeline.
        </p>
      </div>

      <Card className="border-muted/60 shadow-sm">
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No notifications dispatched yet.
            </div>
          ) : (
            <ul>
              {notifications.map((n, i) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 border-b p-3 last:border-0 hover:bg-muted/30"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    {n.channel === 'SMS' && <Smartphone className="h-4 w-4" />}
                    {n.channel === 'EMAIL' && <Mail className="h-4 w-4" />}
                    {n.channel === 'IN_APP' && <Bell className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {n.channel}
                      </Badge>
                      <span className="text-xs font-mono text-foreground">
                        Order #{n.orderId}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{n.to}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateTime(n.sentAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        <MessageSquare className="mr-1 inline h-3 w-3" />
        In production, this log is backed by Termii/Twilio (SMS), Postmark/SendGrid (email),
        and a Firebase Cloud Messaging topic (in-app push). Each pipeline transition in the
        order flow triggers the matching template automatically.
      </p>
    </div>
  )
}
