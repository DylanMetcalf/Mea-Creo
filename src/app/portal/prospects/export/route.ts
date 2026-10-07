import { getDb } from "@/db";
import { requireClient } from "@/modules/auth/context";
import { listProspects } from "@/modules/prospecting/service";

const cell = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/"/g, '""');
  // Neutralise spreadsheet formulas in exported data.
  return `"${/^[=+\-@]/.test(s) ? `'${s}` : s}"`;
};

/** CSV of every prospect released to this client. */
export async function GET() {
  const ctx = await requireClient("portal.access");
  const rows = await listProspects(await getDb(), ctx.organisationId, { releasedOnly: true });
  const header = [
    "Week of",
    "Company",
    "Website",
    "Industry",
    "Location",
    "Contact",
    "Role",
    "Email",
    "Phone",
    "LinkedIn",
    "Why a fit",
    "Source",
    "Status",
    "Notes",
  ];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((p) =>
      [
        p.weekOf,
        p.company,
        p.website,
        p.industry,
        p.location,
        p.contactName,
        p.contactRole,
        p.email,
        p.phone,
        p.linkedinUrl,
        p.reason,
        p.source,
        p.status,
        p.clientNote,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mea-creo-prospects.csv"',
      "Cache-Control": "no-store",
    },
  });
}
