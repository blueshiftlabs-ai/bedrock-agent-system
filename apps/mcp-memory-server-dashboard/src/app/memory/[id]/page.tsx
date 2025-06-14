import { MemoryDetailModal } from '@/components/memory-detail-modal'
import { DashboardNavigation } from '@/components/dashboard-navigation'

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  return (
    <div className="min-h-screen bg-background">
      <DashboardNavigation />
      <main className="container mx-auto px-4 py-6">
        <MemoryDetailModal 
          memoryId={id} 
          isModal={false}
        />
      </main>
    </div>
  )
}