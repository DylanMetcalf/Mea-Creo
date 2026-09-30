import { health } from "../types";
import type { CalendarEvent, CalendarEventInput, CalendarProvider, TimeSlot } from "./types";

export class MockCalendarProvider implements CalendarProvider {
  readonly kind = "calendar" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly events = new Map<string, CalendarEvent>();
  private seq = 0;

  async healthCheck() {
    return health(this, "CONNECTED", "Mock calendar. Events are kept in memory only.");
  }

  async getBusy(calendarId: string, range: TimeSlot): Promise<TimeSlot[]> {
    return [...this.events.values()]
      .filter((e) => e.calendarId === calendarId && e.status === "confirmed")
      .filter((e) => e.start < range.end && e.end > range.start)
      .map((e) => ({ start: e.start, end: e.end }));
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const externalId = `mock-event-${++this.seq}`;
    const event: CalendarEvent = {
      ...input,
      externalId,
      status: "confirmed",
      meetingUrl: input.withMeetingLink ? `https://meet.example.test/${externalId}` : undefined,
    };
    this.events.set(externalId, event);
    return event;
  }

  async updateEvent(externalId: string, input: Partial<CalendarEventInput>) {
    const existing = this.events.get(externalId);
    if (!existing) throw new Error(`Unknown mock event ${externalId}`);
    const updated = { ...existing, ...input };
    this.events.set(externalId, updated);
    return updated;
  }

  async cancelEvent(_calendarId: string, externalId: string) {
    const existing = this.events.get(externalId);
    if (existing) this.events.set(externalId, { ...existing, status: "cancelled" });
  }
}
