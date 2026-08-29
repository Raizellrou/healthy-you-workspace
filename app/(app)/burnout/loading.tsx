import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /burnout — a roster list rather than the
 *  route-group generic's stat-tile grid. */
export default function BurnoutLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-56" rounded="lg" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" rounded="xl" />
        ))}
      </div>
    </div>
  );
}
