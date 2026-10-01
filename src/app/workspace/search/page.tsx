import { and, desc, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { clients, contacts, invoices, leads, proposals, tasks } from "@/db/schema";
import { requireStaff, staffClientScope } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Search" };

type Hit = { href: string; title: string; detail: string };

export default async function SearchPage({ searchParams }: PageProps<"/workspace/search">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const groups: { title: string; hits: Hit[] }[] = [];
  if (q.length >= 2) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const scope = await staffClientScope(ctx);
    const scoped = (col: Parameters<typeof inArray>[0]): SQL | undefined =>
      scope === "all"
        ? undefined
        : inArray(col, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]);
    const db = await getDb();
    const [c, ct, l, t, p, i] = await Promise.all([
      db
        .select()
        .from(clients)
        .where(
          and(
            or(
              ilike(clients.name, like),
              ilike(clients.website, like),
              ilike(clients.industry, like),
            ),
            scoped(clients.organisationId),
          ),
        )
        .limit(10),
      db
        .select()
        .from(contacts)
        .where(
          and(
            or(ilike(contacts.name, like), ilike(contacts.email, like)),
            scoped(contacts.organisationId),
          ),
        )
        .limit(10),
      ctx.can("leads.read")
        ? db
            .select()
            .from(leads)
            .where(
              or(
                ilike(leads.company, like),
                ilike(leads.contactName, like),
                ilike(leads.email, like),
                ilike(leads.website, like),
              ),
            )
            .orderBy(desc(leads.createdAt))
            .limit(10)
        : Promise.resolve([]),
      db
        .select()
        .from(tasks)
        .where(and(ilike(tasks.title, like), scoped(tasks.organisationId)))
        .orderBy(desc(tasks.createdAt))
        .limit(10),
      ctx.can("leads.read")
        ? db
            .select()
            .from(proposals)
            .where(or(ilike(proposals.companyName, like), ilike(proposals.number, like)))
            .limit(10)
        : Promise.resolve([]),
      ctx.can("billing.read")
        ? db
            .select()
            .from(invoices)
            .where(and(ilike(invoices.number, like), scoped(invoices.organisationId)))
            .limit(10)
        : Promise.resolve([]),
    ]);
    groups.push(
      {
        title: "Clients",
        hits: c.map((x) => ({
          href: `/workspace/clients/${x.organisationId}`,
          title: x.name,
          detail: [x.industry, x.website].filter(Boolean).join(" · "),
        })),
      },
      {
        title: "Contacts",
        hits: ct.map((x) => ({
          href: `/workspace/clients/${x.organisationId}`,
          title: x.name,
          detail: [x.role, x.email].filter(Boolean).join(" · "),
        })),
      },
      {
        title: "Leads",
        hits: l.map((x) => ({
          href: `/workspace/leads/${x.id}`,
          title: x.company,
          detail: `${statusLabel(x.stage)}${x.contactName ? ` · ${x.contactName}` : ""}`,
        })),
      },
      {
        title: "Tasks",
        hits: t.map((x) => ({
          href: `/workspace/tasks?task=${x.id}&tab=open`,
          title: x.title,
          detail: statusLabel(x.status),
        })),
      },
      {
        title: "Proposals",
        hits: p.map((x) => ({
          href: `/workspace/proposals/${x.id}`,
          title: `${x.number} · ${x.companyName}`,
          detail: statusLabel(x.status),
        })),
      },
      {
        title: "Invoices",
        hits: i.map((x) => ({
          href: `/workspace/billing/${x.id}`,
          title: x.number,
          detail: statusLabel(x.status),
        })),
      },
    );
  }
  const found = groups.filter((g) => g.hits.length);
  return (
    <>
      <PageHeader
        title="Search"
        description={
          q
            ? `Results for "${q}"`
            : "Search clients, contacts, leads, tasks, proposals and invoices."
        }
      />
      <form action="/workspace/search" className="mb-6 max-w-xl">
        <label htmlFor="search-page-q" className="sr-only">
          Search
        </label>
        <input
          id="search-page-q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          className="border-border-strong bg-surface h-11 w-full rounded-lg border px-4 text-sm"
          placeholder="Type at least two characters"
        />
      </form>
      {q.length >= 2 && found.length === 0 && (
        <EmptyState
          title="Nothing found"
          description="Try a company name, a contact, an email address or an invoice number."
        />
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {found.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} />
            <ul className="divide-border divide-y">
              {g.hits.map((h) => (
                <li key={h.href + h.title}>
                  <Link href={h.href} className="hover:bg-surface-2 block px-5 py-2.5">
                    <span className="block text-sm font-medium">{h.title}</span>
                    {h.detail && <span className="text-muted block text-xs">{h.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
