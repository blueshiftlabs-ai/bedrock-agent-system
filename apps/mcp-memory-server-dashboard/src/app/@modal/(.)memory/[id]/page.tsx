'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { MemoryDetailModal } from '@/components/memory-detail-modal'

interface MemoryModalPageProps {
  params: Promise<{ id: string }>
}

export default function MemoryModalPage({ params }: MemoryModalPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)

  return (
    <MemoryDetailModal 
      memoryId={resolvedParams.id} 
      onClose={() => router.back()}
      isModal={true}
    />
  )
}