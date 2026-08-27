import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/icons/Icon";
import { getCurrentPerson } from "@/lib/supabase/people";
import { scopeLabel } from "@/lib/authz";

/**
 * P8 item 8: the transparency page.
 *
 * For a product that ingests workplace activity data, the credible answer
 * to "isn't this surveillance?" is a shipped page, not a slide. Everything
 * below describes behaviour that is actually enforced in Postgres — each
 * claim names the migration or module that implements it, so it can be
 * checked rather than trusted.
 *
 * If you change a policy, change this page in the same commit. A stale
 * transparency page is worse than none.
 */

interface Collected {
  what: string;
  why: string;
  where: string;
}

const COLLECTED: Collected[] = [
  {
    what: "Clock in / out times and breaks",
    why: "Hours worked, streaks without a day off, and whether long days include any break.",
    where: "work_sessions, session_breaks (0012)",
  },
  {
    what: "Task activity — created, completed, reassigned, commented",
    why: "Workload, overdue counts, and whether activity happens outside working hours.",
    where: "task_events (0011)",
  },
  {
    what: "Approved and pending leave",
    why: "Time since last break from work; blocks clocking in while signed off.",
    where: "pto_requests (0012)",
  },
  {
    what: "Daily mood check-ins",
    why: "Team and org trends only. Never shown per person to anyone else.",
    where: "mood_checkins (0003)",
  },
  {
    what: "Kudos sent and received",
    why: "Recognition coverage — specifically, who is being missed.",
    where: "kudos (0003)",
  },
  {
    what: "Notification delivery decisions",
    why: "Whether quiet hours and focus sessions actually held messages back.",
    where: "notifications (0014)",
  },
  {
    what: "Meeting hours, and modelled meeting times",
    why: "Whether anyone gets an uninterrupted run at work.",
    where: "calendar_events (0022)",
  },
];

const NOT_COLLECTED = [
  "Keystrokes, mouse movement, or idle detection",
  "Screenshots or screen recording",
  "The content of your messages — Right to Disconnect stores a short preview you typed yourself, and nothing else",
  "Browser history, application usage, or anything outside this app",
  "Location, camera, or microphone",
  "Anything at all while you are clocked out — the app records events you take in it, not time you spend elsewhere",
];

interface RoleRow {
  role: string;
  sees: string;
  cannot: string;
}

const ROLE_MATRIX: RoleRow[] = [
  {
    role: "Everyone",
    sees: "Their own everything. The org directory. Shared task boards. Their own 1:1 records, including the agenda written about them.",
    cannot: "Anyone else's hours, burnout score, leave, mood, or calendar.",
  },
  {
    role: "Manager",
    sees: "The above, plus hours, burnout scores, task load, leave, and meeting shape for the people on their team.",
    cannot:
      "Individual mood answers, individual pulse answers, who raised an anonymous concern, or any of it for someone on another team.",
  },
  {
    role: "HR",
    sees: "The above, organisation-wide, plus anonymous concern reports and aggregate notification statistics.",
    cannot: "Individual mood answers, individual pulse answers, or the identity behind an anonymous report.",
  },
];

interface Guarantee {
  title: string;
  detail: string;
  ref: string;
}

const GUARANTEES: Guarantee[] = [
  {
    title: "Mood and pulse answers are never readable per person",
    detail:
      "Both are gated at three responses. Below that the app returns nothing at all rather than a number you could work backwards from. Pulse answers go further: the responses table grants no read permission to anyone, at any role — including you. The system can tell that you answered, never what you answered.",
    ref: "0003, 0016, 0023",
  },
  {
    title: "Concern reports can be genuinely anonymous",
    detail:
      "When you tick anonymous, the reporter column is written as null — not hidden in the interface, absent from the row. There is no query that recovers it because there is nothing to recover.",
    ref: "0016",
  },
  {
    title: "Your manager cannot see your mood",
    detail:
      "This one is deliberately absent rather than merely restricted. The 1:1 agenda generator assembles overdue tasks, workload, streaks and leave — and specifically excludes mood, because a check-in your manager reads is a check-in worth lying to.",
    ref: "lib/one-on-one.ts",
  },
  {
    title: "There are no private notes about you",
    detail:
      "1:1 records have one notes field, visible to both people, and you can always open your own. There is no manager-only field, so there is no file on you assembled from these signals that you cannot read.",
    ref: "0021",
  },
  {
    title: "Nobody can change your notification settings for you",
    detail:
      "A manager can suggest strict quiet hours as an intervention. Only you can apply it. The action refuses if the signed-in person is not the subject.",
    ref: "0019",
  },
  {
    title: "Enforcement is in the database, not the interface",
    detail:
      "Every restriction above is a row-level security policy in Postgres, so it holds regardless of what any screen chooses to render. Hiding a button is not a permission model.",
    ref: "0010",
  },
];

export default async function TransparencyPage() {
  const me = await getCurrentPerson();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHead
        title="What this app knows about you"
        description="Plain language, no exceptions buried in a footnote. Every claim here names the migration or module that enforces it."
      />

      {me ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3">
          <Icon name="eye" size={16} />
          <span className="text-xs text-ink-soft">
            You are signed in as <span className="font-medium text-ink">{me.name}</span>. Your current visibility:
          </span>
          <Chip tone="brand">{scopeLabel(me.appRole)}</Chip>
        </div>
      ) : null}

      <div className="space-y-5">
        <Card>
          <h2 className="text-sm font-bold text-ink">What is collected</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            All of it is counts and timestamps of things you did inside this app.
          </p>
          <ul className="space-y-2.5">
            {COLLECTED.map((row) => (
              <li key={row.what} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                <div className="text-xs font-medium text-ink">{row.what}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{row.why}</p>
                <div className="mt-1 font-mono text-[10px] text-ink-mute">{row.where}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">What is not collected</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Not &ldquo;not shown&rdquo; — never recorded. There is no table for any of this.
          </p>
          <ul className="space-y-1.5">
            {NOT_COLLECTED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                <span className="mt-0.5 shrink-0 text-risk-critical" aria-hidden="true">
                  <Icon name="x" size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Who sees what</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Roles are cumulative — a manager sees everything an employee sees, for their own team.
          </p>
          <div className="space-y-3">
            {ROLE_MATRIX.map((row) => (
              <div key={row.role} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <div className="mb-1 text-xs font-bold text-ink">{row.role}</div>
                <p className="text-xs leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">Can see: </span>
                  {row.sees}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">Cannot see: </span>
                  {row.cannot}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Guarantees, and how they are enforced</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Each of these is a decision that cost something to make. They are listed so they can be checked.
          </p>
          <ul className="space-y-2.5">
            {GUARANTEES.map((g) => (
              <li key={g.title} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold text-ink">{g.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-mute">{g.ref}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{g.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Where this is still imperfect</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            A transparency page that only lists strengths is marketing.
          </p>
          <ul className="space-y-2 text-xs leading-relaxed text-ink-soft">
            <li>
              <span className="font-medium text-ink">Meeting times are modelled.</span> Daily meeting totals are
              real, but this deployment has no calendar integration, so where each meeting sits inside a day is a
              reconstruction. The meeting-load screen says so on the screen itself.
            </li>
            <li>
              <span className="font-medium text-ink">Pulse responses store who answered.</span> They have to, or
              answering twice could not be prevented. The table grants nobody permission to read a score, but the
              honest statement is &ldquo;write-only by policy&rdquo;, not &ldquo;mathematically anonymous&rdquo;.
            </li>
            <li>
              <span className="font-medium text-ink">This is a single-organisation demo.</span> Access control
              separates roles, not tenants. It is not built for hosting several companies in one database.
            </li>
            <li>
              <span className="font-medium text-ink">Burnout scores are a model, not a diagnosis.</span> They
              weight streaks, meeting load, off-hours activity and time since leave. They are a prompt for a
              conversation, and nothing in the app treats them as more than that.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
