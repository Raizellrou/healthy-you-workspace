import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /mood — the mood-picker card, instead of the
 *  route-group generic's 4-stat-tile shape which doesn't apply here. */
export default function MoodLoading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-40" rounded="lg" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-48" rounded="xl" />
      <Skeleton className="mt-4 h-32" rounded="xl" />
    </div>
  );
}
