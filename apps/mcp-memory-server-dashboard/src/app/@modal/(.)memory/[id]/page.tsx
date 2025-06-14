'use client'

import { useRouter } from 'next/navigation'
import { MemoryDetailModal } from '@/components/memory-detail-modal'
import { use } from 'react'

export default function MemoryModalPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  return (
    <MemoryDetailModal 
      memoryId={id} 
      onClose={() => router.back()}
      isModal={true}
    />
  )
}