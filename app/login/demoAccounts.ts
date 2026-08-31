// Demo-only convenience list for the quick-pick dropdown on the login page.
// Only the HR account is offered here — the 24 employee/manager personas
// are still real, seeded logins (scripts/seed.ts) and can still be signed
// into by typing their email/password manually, they're just not surfaced
// in this picker since they can't hold HR-level access.
export const DEMO_ACCOUNTS = ["Petal HR"].map((name) => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@petal.test`,
}));

export const DEMO_PASSWORD = "petal-demo-2026";
