import type { IntegrationAdapter } from "../types";

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface CalendarEventInput {
  calendarId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendees: { email: string; name?: string }[];
  /** Request a video meeting link from the provider where supported. */
  withMeetingLink?: boolean;
}

export interface CalendarEvent extends CalendarEventInput {
  externalId: string;
  meetingUrl?: string;
  status: "confirmed" | "cancelled";
}

export interface CalendarProvider extends IntegrationAdapter {
  readonly kind: "calendar";
  /** Busy periods in the range. Availability rules are applied by the booking module. */
  getBusy(calendarId: string, range: TimeSlot): Promise<TimeSlot[]>;
  createEvent(input: CalendarEventInput): Promise<CalendarEvent>;
  updateEvent(externalId: string, input: Partial<CalendarEventInput>): Promise<CalendarEvent>;
  cancelEvent(calendarId: string, externalId: string): Promise<void>;
}
