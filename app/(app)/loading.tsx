import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-group fallback shown while a page's Server Component resolves.
 *
 * Every authenticated page awaits `getEmployees()`, which fans out to the
 * whole activity history — without this the app showed a blank pane on each
 * navigation. Individual routes can still add a closer-fitting `loading.tsx`.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-52" rounded="lg" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" rounded="xl" />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" rounded="xl" />
        <Skeleton className="h-64" rounded="xl" />
      </div>
    </div>
  );
}
