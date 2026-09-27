import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56 rounded-xl" />
      <SkeletonList count={4} className="h-24 w-full rounded-2xl" />
    </div>
  );
}
