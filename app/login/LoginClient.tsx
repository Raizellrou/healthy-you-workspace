"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demoAccounts";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function quickPick(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <Card className="w-full max-w-sm">
      <div className="mb-5 text-center">
        <h1 className="text-lg font-semibold text-ink">Sign in to AxionHR</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Demo project — pick a seeded account below or enter credentials manually.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>

        {error ? <p className="text-sm text-risk-critical">{error}</p> : null}

        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-5 border-t border-line pt-4">
        <label htmlFor="quick-pick" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
          Quick pick a demo account
        </label>
        <select
          id="quick-pick"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) quickPick(e.target.value);
          }}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="" disabled>
            Choose a person…
          </option>
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.email} value={a.email}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-ink-mute">
          Fills in the shared demo password — not a real security boundary,
          exploration only.
        </p>
      </div>
    </Card>
  );
}
