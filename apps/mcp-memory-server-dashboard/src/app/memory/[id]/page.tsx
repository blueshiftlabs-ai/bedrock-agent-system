import { MemoryDetailModal } from '@/components/memory-detail-modal'

export default function MemoryPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-6">
      <MemoryDetailModal 
        memoryId={params.id} 
        isModal={false}
      />
    </div>
  )
}