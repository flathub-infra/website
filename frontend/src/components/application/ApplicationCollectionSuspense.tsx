import { Suspense, type ComponentProps } from "react"
import ApplicationCollection from "./Collection"
import { ApplicationCardSkeleton } from "./ApplicationCard"
import { Skeleton } from "@/components/ui/skeleton"

interface Props extends ComponentProps<typeof ApplicationCollection> {}

const ApplicationCollectionSkeleton = () => {
  return (
    <section className="flex flex-col gap-3">
      {/* Skeleton for header */}
      <div className="gap-2 flex sm:flex-row flex-col sm:items-center justify-between pb-2">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Skeleton grid matching Collection component layout */}
      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <ApplicationCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ApplicationCollectionSuspense(props: Props) {
  return (
    <Suspense fallback={<ApplicationCollectionSkeleton />}>
      <ApplicationCollection {...props} />
    </Suspense>
  )
}
