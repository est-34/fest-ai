import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";

/** 화면 이동 중 아무 변화가 없으면 눌리지 않은 줄 알고 다시 누르게 된다. */
export default function VisitorLoading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <Skeleton className="h-6 w-40 rounded-md" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <SkeletonList count={3} className="h-16 w-full rounded-xl" />
    </div>
  );
}
