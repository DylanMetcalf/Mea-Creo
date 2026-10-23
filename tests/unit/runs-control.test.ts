import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { agentRuns, emailLog, runs, tasks } from "@/db/schema";
import type { FetchedPage } from "@/modules/audits/fetcher";
import { createClientOrganisation } from "@/modules/onboarding/service";
import { cancelRun, createRun, executeRun } from "@/modules/runs/engine";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
let orgId: string;
beforeAll(async () => {
  ({ db, close } = await testDb());
  orgId = await createClientOrganisation(db, {
    name: "Rockwell Drilling",
    website: "https://rockwell.example",
  });
}, 60_000);
afterAll(() => close());

const html = `<html lang="en"><head><title>Rockwell Drilling</title></head><body><h1>Drilling</h1></body></html>`;
const fetcher = async (u: string | URL): Promise<FetchedPage> => {
  const url = new URL(u).href;
  const home = url === "https://rockwell.example/";
  return {
    url,
    finalUrl: url,
    status: home ? 200 : 404,
    contentType: "text/html",
    body: home ? html : "",
    bytes: html.length,
    responseTimeMs: 1,
    redirects: 0,
  };
};

const counts = async () => ({
  tasks: (await db.select().from(tasks)).length,
  emails: (await db.select().from(emailLog)).length,
  agentRuns: (await db.select().from(agentRuns)).length,
});

describe("run controls", () => {
  it("a dry run reports what would happen but saves, sends and charges nothing", async () => {
    const before = await counts();
    const id = await createRun(db, { organisationId: orgId, kind: "seo_analysis", dryRun: true });
    await executeRun(db, id, { fetcher });
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    expect(run.status).toBe("complete");
    expect(run.summary?.headline).toMatch(/^Dry run: .*Nothing was saved, sent or charged/);
    expect(run.items.length).toBeGreaterThan(0);
    expect(run.costMicroUsd).toBe(0);
    expect(await counts()).toEqual(before);
  });

  it("a cancelled queued run never starts", async () => {
    const id = await createRun(db, { organisationId: orgId, kind: "seo_analysis" });
    expect(await cancelRun(db, id, orgId)).toBe(true);
    await executeRun(db, id, { fetcher });
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    expect(run.status).toBe("cancelled");
    expect(run.items).toEqual([]);
    // Finished runs can't be cancelled, and another client's run can't be touched.
    expect(await cancelRun(db, id, orgId)).toBe(false);
  });

  it("only the owning organisation can cancel", async () => {
    const other = await createClientOrganisation(db, {
      name: "Other",
      website: "https://o.example",
    });
    const id = await createRun(db, { organisationId: orgId, kind: "seo_analysis" });
    expect(await cancelRun(db, id, other)).toBe(false);
    expect(await cancelRun(db, id, orgId)).toBe(true);
  });
});
