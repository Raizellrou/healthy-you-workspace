import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /kudos — the two-column form + sidebar
 *  layout, instead of the route-group generic's stat-tile grid. */
export default function KudosLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-32" rounded="lg" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Skeleton className="h-80" rounded="xl" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24" rounded="xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
