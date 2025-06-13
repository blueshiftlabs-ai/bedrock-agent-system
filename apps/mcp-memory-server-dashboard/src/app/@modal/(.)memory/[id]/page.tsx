'use client'

import { useRouter } from 'next/navigation'
import { MemoryDetailModal } from '@/components/memory-detail-modal'

export default function MemoryModalPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  return (
    <MemoryDetailModal 
      memoryId={params.id} 
      onClose={() => router.back()}
      isModal={true}
    />
  )
}