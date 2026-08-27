/**
 * Truncates user-controlled text for inline interpolation into confirm
 * dialog messages (task titles, project names, etc).
 *
 * Several fields interpolated into `ConfirmModal` messages have no
 * length limit at the database level (see AGENTS.md's Security
 * Requirements — task titles among them). React already escapes the
 * content, so this isn't an XSS guard; it stops an arbitrarily long title
 * from blowing out the dialog layout and pushing its Cancel/Confirm
 * buttons off-screen on what is often a destructive confirm.
 */
export function truncateForConfirm(text: string, maxLength = 80): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
