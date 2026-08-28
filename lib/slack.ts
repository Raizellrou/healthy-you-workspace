/**
 * Minimal Slack delivery for the Right to Disconnect demo — a bot token
 * posting to one fixed channel (SLACK_CHANNEL_ID), not per-employee DMs.
 * Employees have no stored Slack user ID anywhere in the schema, so mapping
 * to real DMs is out of scope; this proves the "delivers immediately"
 * outcome by actually landing in Slack, not just logging a row.
 *
 * Best-effort like lib/notify.ts#enqueue: a missing/invalid token or a
 * failed request never throws. Server-only — SLACK_BOT_TOKEN must stay out
 * of any client bundle, so this is only ever imported from a "use server" file.
 */
export interface SlackSendResult {
  ok: boolean;
  error?: string;
}

/** Slack's mrkdwn gives `&`, `<`, `>` special meaning — unescaped, a
 *  message containing `<!channel>` or `<!here>` would actually page
 *  everyone in the channel. Required escaping per Slack's API docs for
 *  any text built from free-form user input, which a boundary message is. */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendSlackMessage(text: string): Promise<SlackSendResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) {
    return { ok: false, error: "slack_not_configured" };
  }

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text: escapeSlackText(text) }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    return data.ok ? { ok: true } : { ok: false, error: data.error ?? "unknown_error" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}
