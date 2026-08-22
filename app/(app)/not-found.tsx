import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">Not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          That page doesn&apos;t exist, or the record it pointed at has been removed.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
