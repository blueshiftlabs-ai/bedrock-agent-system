'use client'

import { useRouter } from 'next/navigation'
import { MemoryDetailModal } from '@/components/memory-detail-modal'

interface MemoryModalPageProps {
  params: { id: string }
}

export default function MemoryModalPage({ params }: MemoryModalPageProps) {
  const router = useRouter()

  return (
    <MemoryDetailModal 
      memoryId={params.id} 
      onClose={() => router.back()}
      isModal={true}
    />
  )
}