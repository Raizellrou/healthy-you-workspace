import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /dashboard — the session bar's 4 segments
 *  plus the burnout-band grid, instead of the route-group generic. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-40" rounded="lg" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" rounded="xl" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" rounded="xl" />
        ))}
      </div>
    </div>
  );
}
