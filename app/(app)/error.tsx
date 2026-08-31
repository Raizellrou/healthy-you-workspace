"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Error boundary for the authenticated route group.
 *
 * Deliberately does not print `error.message` — a failed query here can carry
 * schema or policy detail, and a row-level-security denial reads as a database
 * error rather than anything the person can act on. The digest is enough to
 * correlate with server logs.
 *
 * The secondary action is a hard reload, not "Back to dashboard". This
 * boundary fires *on* /dashboard often enough (it was the whole symptom of the
 * missing-work_schedules bug) that routing there offered the broken page as
 * the way out of itself — two buttons, neither of which could ever work.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This screen couldn&apos;t load. It&apos;s usually temporary — try again, and if it
          keeps happening the details are in the server log.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-mute">
            Reference {error.digest}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </Card>
    </div>
  );
}
