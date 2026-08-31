import { Skeleton } from "@/components/ui/Skeleton";

/** Closer-fitting fallback for /attendance — 4 stat tiles plus the two
 *  clocked-in/off person-group lists, instead of the route-group generic. */
export default function AttendanceLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-40" rounded="lg" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" rounded="xl" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-line p-4">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-10" rounded="lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
