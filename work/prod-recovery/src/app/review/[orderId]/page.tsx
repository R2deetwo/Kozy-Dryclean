'use client'

import { useParams } from 'next/navigation'
import { ReviewForm } from '@/components/customer/review-form'

export default function ReviewPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = decodeURIComponent(params.orderId || '')
  return <ReviewForm orderId={orderId} />
}
