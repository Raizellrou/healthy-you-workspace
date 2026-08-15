// Demo-only convenience list for the quick-pick dropdown on the login page.
// These are the 24 seeded accounts (scripts/seed.ts) — not a live query,
// since the employees table requires an authenticated session to read.
export const DEMO_ACCOUNTS = [
  "Amara Adeyemi",
  "Beatriz Haddad",
  "Caleb Okafor",
  "Dhruv Bianchi",
  "Elena Ibrahim",
  "Farrah Petrov",
  "Gideon Castillo",
  "Hana Jensen",
  "Idris Quiroga",
  "Junia Duarte",
  "Kwame Koval",
  "Lucia Rahman",
  "Mateo Eriksson",
  "Nadia Lindqvist",
  "Omar Silva",
  "Priya Fontaine",
  "Quinn Moreau",
  "Rosa Tanaka",
  "Sasha Gallo",
  "Tomas Nakamura",
  "Healthy Hannah",
  "Warning Will",
  "Risky Rita",
  "Burnout Bob",
].map((name) => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@axionhr.test`,
}));

export const DEMO_PASSWORD = "axionhr-demo-2026";
