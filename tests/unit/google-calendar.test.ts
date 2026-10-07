import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarProvider } from "@/integrations/calendar/google";
import { googleAuthUrl } from "@/integrations/google/oauth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

function provider(refresh: string | null = "refresh-1") {
  return new GoogleCalendarProvider({
    clientId: "id",
    clientSecret: "secret",
    loadRefreshToken: async () => refresh,
  });
}

describe("Google OAuth", () => {
  it("asks for offline access to calendar events and free/busy only", () => {
    const url = new URL(
      googleAuthUrl(
        { clientId: "id", clientSecret: "s" },
        { redirectUri: "https://x/cb", state: "st", loginHint: "meacreo@gmail.com" },
      ),
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("login_hint")).toBe("meacreo@gmail.com");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).not.toMatch(/auth\/calendar(\s|$)/);
  });
});

describe("GoogleCalendarProvider", () => {
  it("refreshes a token once and reads busy times", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token"))
        return json({ access_token: "at", expires_in: 3600 });
      if (u.endsWith("/freeBusy"))
        return json({
          calendars: {
            primary: { busy: [{ start: "2026-10-08T08:00:00Z", end: "2026-10-08T09:00:00Z" }] },
          },
        });
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = provider();
    const range = {
      start: new Date("2026-10-08T00:00:00Z"),
      end: new Date("2026-10-09T00:00:00Z"),
    };
    const busy = await p.getBusy("primary", range);
    await p.getBusy("primary", range);
    expect(busy).toEqual([
      { start: new Date("2026-10-08T08:00:00Z"), end: new Date("2026-10-08T09:00:00Z") },
    ]);
    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/token"));
    expect(tokenCalls).toHaveLength(1);
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/freeBusy"))!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer at" });
  });

  it("creates events with a Meet link and invitations", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/token")) return json({ access_token: "at", expires_in: 3600 });
      expect(u).toContain("conferenceDataVersion=1");
      expect(u).toContain("sendUpdates=all");
      const body = JSON.parse(String(init?.body));
      expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe("hangoutsMeet");
      return json({ id: "evt1", status: "confirmed", hangoutLink: "https://meet.google.com/abc" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const event = await provider().createEvent({
      calendarId: "primary",
      title: "Strategy call",
      start: new Date("2026-10-08T08:00:00Z"),
      end: new Date("2026-10-08T08:30:00Z"),
      attendees: [{ email: "a@example.com" }],
      withMeetingLink: true,
    });
    expect(event).toMatchObject({ externalId: "evt1", meetingUrl: "https://meet.google.com/abc" });
  });

  it("asks for a connection when no token is stored", async () => {
    expect((await provider(null).healthCheck()).status).toBe("ACTION_REQUIRED");
  });
});
