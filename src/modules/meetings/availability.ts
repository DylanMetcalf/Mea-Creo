import type { Settings } from "@/modules/settings/schema";

export interface Interval {
  start: Date;
  end: Date;
}

/** Offset (minutes) of `timeZone` from UTC at the given instant, e.g. +120 for Africa/Johannesburg. */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The UTC instant for a wall-clock time in `timeZone`. */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

/** Calendar date parts (in `timeZone`) for an instant. */
export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday,
  };
}

export interface DaySlots {
  /** YYYY-MM-DD in the booking time zone. */
  date: string;
  slots: Date[];
}

/**
 * Available meeting start times. Pure function: working days and hours, minimum notice,
 * booking horizon, buffer around existing commitments.
 */
export function computeSlots(input: {
  settings: Settings<"booking">;
  durationMinutes: number;
  busy: Interval[];
  now?: Date;
  stepMinutes?: number;
}): DaySlots[] {
  const { settings, durationMinutes } = input;
  const now = input.now ?? new Date();
  const step = input.stepMinutes ?? 30;
  const earliest = new Date(now.getTime() + settings.minNoticeHours * 3600_000);
  const buffer = settings.bufferMinutes * 60_000;
  const busy = input.busy.map((b) => ({
    start: b.start.getTime() - buffer,
    end: b.end.getTime() + buffer,
  }));
  const days: DaySlots[] = [];

  for (let offset = 0; offset <= settings.horizonDays; offset++) {
    const probe = new Date(now.getTime() + offset * 86400_000);
    const { year, month, day, weekday } = zonedParts(probe, settings.timezone);
    if (!settings.workingDays.includes(weekday)) continue;
    const slots: Date[] = [];
    for (
      let minutes = settings.startHour * 60;
      minutes + durationMinutes <= settings.endHour * 60;
      minutes += step
    ) {
      const start = zonedTime(
        year,
        month,
        day,
        Math.floor(minutes / 60),
        minutes % 60,
        settings.timezone,
      );
      const end = start.getTime() + durationMinutes * 60_000;
      if (start < earliest) continue;
      if (busy.some((b) => start.getTime() < b.end && end > b.start)) continue;
      slots.push(start);
    }
    if (slots.length)
      days.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        slots,
      });
  }
  return days;
}
