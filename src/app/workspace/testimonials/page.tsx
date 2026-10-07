import { MessageSquareQuote } from "lucide-react";
import type { Metadata } from "next";
import { CopyButton } from "@/components/ui/copy-button";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { getDb } from "@/db";
import { fmtRelative } from "@/lib/format";
import { absoluteUrl } from "@/lib/urls";
import { requireStaff } from "@/modules/auth/context";
import { listTestimonials } from "@/modules/testimonials/service";
import { requestTestimonialAction, testimonialStatusAction } from "./actions";

export const metadata: Metadata = { title: "Testimonials" };

const TONE = {
  requested: "neutral",
  submitted: "warning",
  approved: "success",
  hidden: "neutral",
} as const;

export default async function TestimonialsPage() {
  const ctx = await requireStaff("clients.read.assigned");
  const rows = await listTestimonials(await getDb());
  const canWrite = ctx.can("clients.write");
  return (
    <>
      <PageHeader
        eyebrow="Proof"
        title="Testimonials"
        description="Real words from real clients, published only with their consent and your approval. The website's testimonial section stays hidden until one is approved."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          {rows.length === 0 && (
            <EmptyState
              icon={<MessageSquareQuote className="size-6" />}
              title="No testimonials yet"
              description="Create a link and send it to a happy client. It takes them about a minute."
            />
          )}
          {rows.map((t) => (
            <Card key={t.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{t.requestedFrom}</p>
                  <Badge tone={TONE[t.status]} dot>
                    {t.status === "requested" ? "Waiting for them" : t.status}
                  </Badge>
                </div>
                {t.quote ? (
                  <>
                    <blockquote className="font-display text-ink border-brand-300 border-l-2 pl-4 text-[1.1rem] leading-snug">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <p className="text-muted text-sm">
                      Credit as:{" "}
                      {t.attribution === "named"
                        ? [t.name, t.role, t.company].filter(Boolean).join(", ")
                        : `${t.role}, ${t.industry} (no name or company)`}
                      {" · "}consent given {fmtRelative(t.consentAt)}
                    </p>
                    {canWrite && (
                      <div className="flex gap-2">
                        {t.status !== "approved" && (
                          <form action={testimonialStatusAction.bind(null, t.id, "approved")}>
                            <SubmitButton size="sm">Approve for the website</SubmitButton>
                          </form>
                        )}
                        {t.status !== "hidden" && (
                          <form action={testimonialStatusAction.bind(null, t.id, "hidden")}>
                            <SubmitButton size="sm" variant="secondary">
                              {t.status === "approved" ? "Remove from website" : "Don't publish"}
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton
                      value={absoluteUrl(`/testimonial/${t.token}`)}
                      label="Copy their link"
                    />
                    <span className="text-subtle text-xs">Created {fmtRelative(t.createdAt)}</span>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
        {canWrite && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Ask for a testimonial" />
              <CardBody>
                <ActionForm action={requestTestimonialAction} className="space-y-3" resetOnSuccess>
                  <TextField
                    name="requestedFrom"
                    label="Who are you asking?"
                    hint="e.g. Thandi at Harbourline"
                  />
                  <SubmitButton>Create link</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
            <Callout tone="info" title="Why not write them ourselves?">
              Published testimonials have to be real. Invented quotes, even without names, are
              misleading to the people reading them. Clients can choose to be credited only by role
              and industry.
            </Callout>
          </div>
        )}
      </div>
    </>
  );
}
