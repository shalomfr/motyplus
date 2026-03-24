import { Card, CardContent, CardHeader } from "@/components/ui/card"

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

function StatCardSkeleton() {
  return (
    <Card className="border-r-4 border-r-gray-200">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-9 w-9 rounded-lg" />
          <div className="space-y-2 flex-1">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-6 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <SkeletonBar className="h-10 w-10 rounded-md" />
        <SkeletonBar className="h-8 w-40" />
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><SkeletonBar className="h-5 w-32" /></CardHeader>
          <CardContent><SkeletonBar className="h-48 w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><SkeletonBar className="h-5 w-32" /></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonBar className="h-8 w-8 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <SkeletonBar className="h-3 w-3/4" />
                    <SkeletonBar className="h-2 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
