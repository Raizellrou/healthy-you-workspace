import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /focus — mode-picker tiles plus the active
 *  session card, instead of the route-group generic's stat-tile grid. */
export default function FocusLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Skeleton className="mb-5 h-20" rounded="xl" />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24" rounded="xl" />
        ))}
      </div>

      <Skeleton className="mb-8 h-20" rounded="xl" />
      <Skeleton className="h-24" rounded="xl" />
    </div>
  );
}
