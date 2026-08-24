'use client'

import { useState } from 'react'
import { CustomerLanding } from '@/components/customer/customer-landing'
import { CustomerPortal } from '@/components/customer/customer-portal'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { DriverView } from '@/components/driver/driver-view'
import { RoleSwitcher } from '@/components/shell/role-switcher'

type Portal = 'landing' | 'customer' | 'admin' | 'driver'

export default function Home() {
  const [portal, setPortal] = useState<Portal>('landing')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <RoleSwitcher portal={portal} onChange={setPortal} />
      <main className="flex-1">
        {portal === 'landing' && (
          <CustomerLanding
            onBook={() => setPortal('customer')}
            onPortal={() => setPortal('customer')}
          />
        )}
        {portal === 'customer' && (
          <CustomerPortal
            initialView="dashboard"
            onBackToLanding={() => setPortal('landing')}
          />
        )}
        {portal === 'admin' && <AdminDashboard />}
        {portal === 'driver' && <DriverView />}
      </main>
    </div>
  )
}
