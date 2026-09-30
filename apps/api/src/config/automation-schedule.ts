/** Parses HH:MM or HH:MM:SS in 24-hour server-local time. */
export function parseAutomationSweepTime(
  raw: string,
): { hour: number; minute: number; second: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;

  return { hour, minute, second };
}

/** BullMQ six-field cron (sec min hour dom month dow) for a daily run. */
export function automationSweepCronPattern(time: string): string {
  const parsed = parseAutomationSweepTime(time);
  if (!parsed) {
    throw new Error(
      `Invalid AUTOMATION_SWEEP_TIME "${time}" — use HH:MM or HH:MM:SS (24h, server local time)`,
    );
  }
  const { hour, minute, second } = parsed;
  return `${second} ${minute} ${hour} * * *`;
}

export function formatAutomationSweepTime(time: string): string {
  const parsed = parseAutomationSweepTime(time);
  if (!parsed) return time;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsed.hour)}:${pad(parsed.minute)}:${pad(parsed.second)}`;
}
