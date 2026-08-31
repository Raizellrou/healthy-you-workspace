import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /tasks — a vertical list of task rows,
 *  instead of the route-group generic's stat-tile shape. */
export default function TasksLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-32" rounded="lg" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14" rounded="lg" />
        ))}
      </div>
    </div>
  );
}
