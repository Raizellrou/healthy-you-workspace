"use client";

import { useState } from "react";
import { getSafeReturnUrl } from "./returnUrl";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { gradientButtonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { createClient } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demoAccounts";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    router.push(getSafeReturnUrl(window.location.search));
    router.refresh();
  }

  function quickPick(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <Card className="p-8 shadow-xl">
      <div className="text-center">
        <Eyebrow centered>A demo HR wellbeing platform</Eyebrow>
        <h1 className="mt-3.5 font-display text-2xl font-medium tracking-tight text-ink">Sign in to Petal</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Demo project — pick a seeded account below or enter credentials manually.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
        <Field label="Email" required>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" required>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-mute hover:text-ink"
              >
                <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
              </button>
            </div>
          )}
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={gradientButtonClassName("mt-1 w-full py-3")}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-7 border-t border-line pt-6">
        <Field
          label="Quick pick a demo account"
          hint="Fills in the shared demo password — not a real security boundary, exploration only."
        >
          {(p) => (
            <Select
              {...p}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) quickPick(e.target.value);
              }}
              options={[
                { value: "", label: "Choose a person…", disabled: true },
                ...DEMO_ACCOUNTS.map((a) => ({ value: a.email, label: a.name })),
              ]}
            />
          )}
        </Field>
      </div>
    </Card>
  );
}
