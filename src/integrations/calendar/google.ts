import { GoogleAuthError, type GoogleClient, refreshAccessToken } from "../google/oauth";
import { health } from "../types";
import type { CalendarEvent, CalendarEventInput, CalendarProvider, TimeSlot } from "./types";

const API = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarOptions extends GoogleClient {
  /** Loads the stored refresh token (decrypted), or null when not connected yet. */
  loadRefreshToken: () => Promise<string | null>;
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  hangoutLink?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: { email: string; displayName?: string }[];
}

/**
 * Google Calendar via the REST API (OAuth, no SDK). Busy times come from free/busy;
 * events are created with a Google Meet link and invitations sent by Google.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly kind = "calendar" as const;
  readonly provider = "google";
  readonly isMock = false;
  private access: { token: string; expiresAt: number } | null = null;

  constructor(private readonly options: GoogleCalendarOptions) {}

  private async token(): Promise<string> {
    if (this.access && this.access.expiresAt - 60_000 > Date.now()) return this.access.token;
    const refresh = await this.options.loadRefreshToken();
    if (!refresh) throw new GoogleAuthError("not_connected");
    const t = await refreshAccessToken(this.options, refresh);
    this.access = { token: t.accessToken, expiresAt: t.expiresAt };
    return t.accessToken;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (res.status === 401) this.access = null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Google Calendar ${init.method ?? "GET"} ${path}: ${res.status} ${body.slice(0, 200)}`,
      );
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  async healthCheck() {
    if (!(await this.options.loadRefreshToken()))
      return health(
        this,
        "ACTION_REQUIRED",
        "Connect Google Calendar in Settings → Integrations (sign in with the calendar account).",
      );
    try {
      const now = new Date();
      await this.getBusy("primary", { start: now, end: new Date(now.getTime() + 3600_000) });
      return health(this, "CONNECTED", "Google Calendar connected.");
    } catch (error) {
      if (error instanceof GoogleAuthError && error.needsReconnect)
        return health(this, "ACTION_REQUIRED", "Google access was revoked or expired. Reconnect.");
      return health(this, "ERROR", error instanceof Error ? error.message : "Health check failed.");
    }
  }

  async getBusy(calendarId: string, range: TimeSlot): Promise<TimeSlot[]> {
    const data = await this.call<{
      calendars: Record<string, { busy?: { start: string; end: string }[] }>;
    }>("/freeBusy", {
      method: "POST",
      body: JSON.stringify({
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    return (data.calendars[calendarId]?.busy ?? []).map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
  }

  private toEvent(
    calendarId: string,
    e: GoogleEvent,
    fallback?: CalendarEventInput,
  ): CalendarEvent {
    return {
      calendarId,
      externalId: e.id,
      title: e.summary ?? fallback?.title ?? "",
      description: e.description ?? fallback?.description,
      start: e.start?.dateTime ? new Date(e.start.dateTime) : fallback!.start,
      end: e.end?.dateTime ? new Date(e.end.dateTime) : fallback!.end,
      attendees: (e.attendees ?? []).map((a) => ({ email: a.email, name: a.displayName })),
      meetingUrl: e.hangoutLink,
      status: e.status === "cancelled" ? "cancelled" : "confirmed",
    };
  }

  private body(input: Partial<CalendarEventInput>) {
    return {
      ...(input.title !== undefined ? { summary: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.start ? { start: { dateTime: input.start.toISOString() } } : {}),
      ...(input.end ? { end: { dateTime: input.end.toISOString() } } : {}),
      ...(input.attendees
        ? { attendees: input.attendees.map((a) => ({ email: a.email, displayName: a.name })) }
        : {}),
      ...(input.withMeetingLink
        ? {
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    };
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const e = await this.call<GoogleEvent>(
      `/calendars/${encodeURIComponent(input.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      { method: "POST", body: JSON.stringify(this.body(input)) },
    );
    return this.toEvent(input.calendarId, e, input);
  }

  async updateEvent(externalId: string, input: Partial<CalendarEventInput>) {
    const calendarId = input.calendarId ?? "primary";
    const e = await this.call<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}?conferenceDataVersion=1&sendUpdates=all`,
      { method: "PATCH", body: JSON.stringify(this.body(input)) },
    );
    return this.toEvent(calendarId, e);
  }

  async cancelEvent(calendarId: string, externalId: string) {
    await this.call(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}?sendUpdates=all`,
      { method: "DELETE" },
    );
  }
}
