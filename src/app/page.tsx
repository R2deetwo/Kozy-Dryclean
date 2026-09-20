'use client'

import { CustomerLanding } from '@/components/customer/customer-landing'
import { PublicNav } from '@/components/shell/public-nav'

export default function Home() {
  return (
    <>
      {/* Top nav with services link + login/signup buttons (shared with
          /services, phase 45) */}
      <PublicNav />

      <CustomerLanding
        onBook={() => {
          // Straight to booking — guests can check out without an account
          window.location.href = '/book'
        }}
        onBookShoes={() => {
          // Shoe-care section CTA — deep-link straight into the wizard's
          // Shoes tab so sneaker customers land on the shoe list.
          window.location.href = '/book?service=shoes'
        }}
        onPortal={() => {
          window.location.href = '/login'
        }}
      />
    </>
  )
}
