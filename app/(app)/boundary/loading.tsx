import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /boundary — the compose card plus the
 *  recent-activity/held-messages column, instead of the route-group
 *  generic's stat-tile shape. */
export default function BoundaryLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" rounded="lg" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" rounded="xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40" rounded="xl" />
          <Skeleton className="h-40" rounded="xl" />
        </div>
      </div>
    </div>
  );
}
