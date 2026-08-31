"use client";

import { useState } from "react";
import { getSafeReturnUrl } from "./returnUrl";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { gradientButtonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { createClient } from "@/lib/supabase/client";

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

  return (
    <Card className="p-8 shadow-xl">
      <div className="text-center">
        <Eyebrow centered>A demo HR wellbeing platform</Eyebrow>
        <h1 className="mt-3.5 font-display text-2xl font-medium tracking-tight text-ink">Sign in to Petal</h1>
        <p className="mt-2 text-sm text-ink-soft">Demo project. Sign in with your seeded account.</p>
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
    </Card>
  );
}
