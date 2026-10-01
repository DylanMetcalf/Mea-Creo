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
  /** Override the days of the week (e.g. discovery calls only Mon–Wed). */
  workingDays?: number[];
  /** Meetings already booked per local date (YYYY-MM-DD), for the daily maximum. */
  bookedPerDay?: Map<string, number>;
}): DaySlots[] {
  const { settings, durationMinutes } = input;
  const now = input.now ?? new Date();
  const step = input.stepMinutes ?? 30;
  const workingDays = input.workingDays ?? settings.workingDays;
  let earliest = new Date(now.getTime() + settings.minNoticeHours * 3600_000);
  // Business-day notice: the first bookable day is the Nth weekday after today.
  if (settings.minNoticeBusinessDays > 0) {
    let counted = 0;
    let offset = 0;
    let first = "";
    while (counted < settings.minNoticeBusinessDays && offset < 40) {
      offset++;
      const p = zonedParts(new Date(now.getTime() + offset * 86400_000), settings.timezone);
      if (p.weekday >= 1 && p.weekday <= 5) {
        counted++;
        first = `${p.year}-${p.month}-${p.day}`;
      }
    }
    const [y, m, d] = first.split("-").map(Number);
    const startOfDay = zonedTime(y, m, d, 0, 0, settings.timezone);
    if (startOfDay > earliest) earliest = startOfDay;
  }
  const buffer = settings.bufferMinutes * 60_000;
  const busy = input.busy.map((b) => ({
    start: b.start.getTime() - buffer,
    end: b.end.getTime() + buffer,
  }));
  const days: DaySlots[] = [];

  for (let offset = 0; offset <= settings.horizonDays; offset++) {
    const probe = new Date(now.getTime() + offset * 86400_000);
    const { year, month, day, weekday } = zonedParts(probe, settings.timezone);
    if (!workingDays.includes(weekday)) continue;
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (
      settings.maxBookingsPerDay > 0 &&
      (input.bookedPerDay?.get(dateKey) ?? 0) >= settings.maxBookingsPerDay
    )
      continue;
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
    if (slots.length) days.push({ date: dateKey, slots });
  }
  return days;
}
