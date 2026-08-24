'use client'

import { useState } from 'react'
import { CustomerPortal } from '@/components/customer/customer-portal'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { DriverView } from '@/components/driver/driver-view'
import { RoleSwitcher } from '@/components/shell/role-switcher'

export default function Home() {
  const [portal, setPortal] = useState<'customer' | 'admin' | 'driver'>('customer')

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <RoleSwitcher portal={portal} onChange={setPortal} />
      <main className="flex-1">
        {portal === 'customer' && <CustomerPortal />}
        {portal === 'admin' && <AdminDashboard />}
        {portal === 'driver' && <DriverView />}
      </main>
    </div>
  )
}
