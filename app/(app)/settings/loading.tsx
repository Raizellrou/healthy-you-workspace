import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /settings/* — stacked form cards, instead of
 *  the route-group generic's stat-tile grid which doesn't apply to forms. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-64" rounded="lg" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="flex flex-col gap-6">
        <Skeleton className="h-56" rounded="xl" />
        <Skeleton className="h-40" rounded="xl" />
      </div>
    </div>
  );
}
