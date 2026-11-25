// Legacy values store a literal wall clock. Zoned values store an instant.
const tokyoClock = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function exerciseClockTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const legacy = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d)(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (legacy) return `${legacy[1]}:${legacy[2]}`;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : tokyoClock.format(instant);
}
