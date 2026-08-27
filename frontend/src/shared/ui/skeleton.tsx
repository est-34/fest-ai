import { cn } from "@/shared/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/** 같은 모양 스켈레톤 n개. 목록 자리표시자에서 Array.from을 반복하지 않기 위해. */
function SkeletonList({ count, className, wrapperClassName }: { count: number; className?: string; wrapperClassName?: string }) {
  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} className={className} />)}
    </div>
  )
}

export { Skeleton, SkeletonList }
