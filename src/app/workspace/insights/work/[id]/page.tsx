import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { CASE_STUDY_TYPES, caseStudies, CONTENT_STATUSES } from "@/db/schema";
import { humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { saveCaseStudyAction } from "../../actions";

export const metadata: Metadata = { title: "Case study" };

export default async function CaseStudyEditorPage({
  params,
}: PageProps<"/workspace/insights/work/[id]">) {
  await requireStaff("content.write");
  const { id } = await params;
  const isNew = id === "new";
  const [c] = isNew
    ? []
    : await (await getDb()).select().from(caseStudies).where(eq(caseStudies.id, id)).limit(1);
  if (!isNew && !c) notFound();
  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/insights" className="hover:text-ink">
          Website content
        </Link>{" "}
        / {c?.title ?? "New case study"}
      </div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{c?.title ?? "New case study"}</h1>
      <div className="mb-6">
        <Callout tone="warning" title="Real work only">
          Publish only with the client&apos;s written permission. Outcomes appear publicly only when
          marked verified with a source.
        </Callout>
      </div>
      <ActionForm action={saveCaseStudyAction} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <input type="hidden" name="caseStudyId" value={c?.id ?? ""} />
        <Card>
          <CardBody className="space-y-4">
            <TextField name="title" label="Title" defaultValue={c?.title} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="clientName" label="Client" defaultValue={c?.clientName} required />
              <TextField name="industry" label="Industry" defaultValue={c?.industry ?? ""} />
            </div>
            <TextArea name="summary" label="Summary" defaultValue={c?.summary} rows={3} />
            <TextArea
              name="challenge"
              label="Challenge"
              defaultValue={c?.challenge ?? ""}
              rows={4}
            />
            <TextArea name="strategy" label="Strategy" defaultValue={c?.strategy ?? ""} rows={4} />
            <TextArea
              name="workCompleted"
              label="Work completed"
              defaultValue={c?.workCompleted ?? ""}
              rows={4}
            />
            <TextArea
              name="outcomes"
              label="Outcomes"
              defaultValue={c?.outcomes
                .map((o) =>
                  [o.label, o.value, o.source ?? "", o.verified ? "verified" : ""].join(" | "),
                )
                .join("\n")}
              rows={4}
              hint='One per line: "Label | Value | Source | verified". Leave the last part empty until checked.'
            />
            <TextField name="timeline" label="Timeline" defaultValue={c?.timeline ?? ""} />
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Publishing" />
          <CardBody className="space-y-3">
            <SelectField
              name="type"
              label="Type"
              defaultValue={c?.type ?? "case_study"}
              options={CASE_STUDY_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            />
            <SelectField
              name="status"
              label="Status"
              defaultValue={c?.status ?? "draft"}
              options={CONTENT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
            <CheckboxField
              name="clientPermission"
              label="The client agreed in writing to be featured"
              defaultChecked={c?.clientPermission}
            />
            <SubmitButton>Save</SubmitButton>
          </CardBody>
        </Card>
      </ActionForm>
    </>
  );
}
