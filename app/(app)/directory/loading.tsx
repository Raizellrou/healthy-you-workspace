import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /directory — collapsible risk-band "folder
 *  shelf" groups, instead of the route-group generic's stat-tile shape. */
export default function DirectoryLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-32" rounded="lg" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line p-4">
            <Skeleton className="h-5 w-40" rounded="lg" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, j) => (
                <Skeleton key={j} className="h-9 w-9" rounded="full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
