const TIME_RE = /^(\d{1,2})(?::(\d{1,2}))?\s?(am|pm|a|p)?$/;

export function parseTimeInput(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(TIME_RE);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3];

  if (minute > 59) return null;

  if (meridiem) {
    if (hour > 12 || hour < 1) return null;
    const isPM = meridiem.startsWith("p");
    if (hour === 12) hour = isPM ? 12 : 0;
    else hour = isPM ? hour + 12 : hour;
  } else {
    if (hour > 23) return null;
  }

  return hour * 60 + minute;
}

export function fmtClock(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

export function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}
