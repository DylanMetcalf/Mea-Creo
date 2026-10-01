import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import {
  CONTENT_STATUSES,
  INSIGHT_CATEGORIES,
  INSIGHT_CATEGORY_LABELS,
  insights,
} from "@/db/schema";
import { humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { saveInsightAction } from "../actions";

export const metadata: Metadata = { title: "Article" };

export default async function InsightEditorPage({ params }: PageProps<"/workspace/insights/[id]">) {
  const ctx = await requireStaff("content.write");
  const { id } = await params;
  const isNew = id === "new";
  const [a] = isNew
    ? []
    : await (await getDb()).select().from(insights).where(eq(insights.id, id)).limit(1);
  if (!isNew && !a) notFound();
  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/insights" className="hover:text-ink">
          Website content
        </Link>{" "}
        / {a?.title ?? "New article"}
      </div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{a?.title ?? "New article"}</h1>
        {a?.status === "published" && (
          <LinkButton href={`/insights/${a.slug}`} variant="secondary" target="_blank">
            View live <ExternalLink className="size-3.5" aria-hidden />
          </LinkButton>
        )}
      </div>
      <ActionForm action={saveInsightAction} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <input type="hidden" name="insightId" value={a?.id ?? ""} />
        <Card>
          <CardBody className="space-y-4">
            <TextField name="title" label="Title" defaultValue={a?.title} required />
            <TextArea
              name="summary"
              label="Summary"
              defaultValue={a?.summary}
              rows={2}
              hint="Shown on the Insights page and in search results."
            />
            <TextArea
              name="body"
              label="Article (Markdown)"
              defaultValue={a?.body}
              rows={24}
              hint="Use ## for headings. Answer the question directly first; cite sources; no guarantees."
            />
            <TextArea
              name="faq"
              label="FAQ (optional)"
              defaultValue={a?.faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}
              rows={6}
              hint="Q: … then A: … with a blank line between pairs. Adds FAQ structured data."
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Publishing" />
            <CardBody className="space-y-3">
              <SelectField
                name="status"
                label="Status"
                defaultValue={a?.status ?? "draft"}
                options={CONTENT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
              />
              <SelectField
                name="category"
                label="Category"
                defaultValue={a?.category}
                options={INSIGHT_CATEGORIES.map((c) => ({
                  value: c,
                  label: INSIGHT_CATEGORY_LABELS[c],
                }))}
              />
              <TextField
                name="authorName"
                label="Author"
                defaultValue={a?.authorName ?? ctx.user.name}
              />
              <TextField
                name="slug"
                label="URL slug"
                defaultValue={a?.slug}
                hint="Leave blank to use the title."
              />
              <SubmitButton>Save</SubmitButton>
              <p className="text-muted text-xs">
                Publishing runs a quality check that blocks guarantees and unsupported claims.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Search appearance" />
            <CardBody className="space-y-3">
              <TextField
                name="seoTitle"
                label="SEO title"
                defaultValue={a?.seoTitle ?? ""}
                hint="Up to 70 characters."
              />
              <TextArea
                name="seoDescription"
                label="Meta description"
                defaultValue={a?.seoDescription ?? ""}
                rows={3}
                hint="Up to 170 characters."
              />
            </CardBody>
          </Card>
        </div>
      </ActionForm>
    </>
  );
}
