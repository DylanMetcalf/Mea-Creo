import { Camera, Eye } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { CopyButton } from "@/components/ui/copy-button";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import {
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_PHOTOS,
  type PortfolioCategory,
} from "@/content/portfolio";
import { getDb } from "@/db";
import { fmtDate, fmtRelative } from "@/lib/format";
import { absoluteUrl } from "@/lib/urls";
import { requireStaff } from "@/modules/auth/context";
import { listPortfolioLinks } from "@/modules/portfolio/service";
import { createPortfolioLinkAction, revokePortfolioLinkAction } from "./actions";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const ctx = await requireStaff("leads.read");
  const links = await listPortfolioLinks(await getDb());
  const cats = Object.keys(PORTFOLIO_CATEGORIES) as PortfolioCategory[];
  const now = new Date();
  return (
    <>
      <PageHeader
        eyebrow="Photography"
        title="Portfolio"
        description="Your photography, kept off the public website. Create a private link for anyone who asks, choose what they see, and see when they open it."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          {cats.map((c) => {
            const photos = PORTFOLIO_PHOTOS.filter((p) => p.category === c);
            return (
              <section key={c}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  {PORTFOLIO_CATEGORIES[c]} <Badge>{photos.length}</Badge>
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {photos.map((p, i) => (
                    <Image
                      key={p.src}
                      src={p.src}
                      alt={`${PORTFOLIO_CATEGORIES[c]} photograph ${i + 1}`}
                      width={240}
                      height={240}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <p className="text-muted text-xs">
            Imported from your previous website. Matric dance photos weren&apos;t imported: they
            show school-leavers, some likely under 18, and POPIA requires a guardian&apos;s consent
            for children&apos;s information.
          </p>
        </div>
        <div className="space-y-6">
          {ctx.can("leads.write") && (
            <Card>
              <CardHeader
                title="Share a selection"
                description="Each link is private and can expire."
              />
              <CardBody>
                <ActionForm action={createPortfolioLinkAction} className="space-y-4" resetOnSuccess>
                  <TextField name="label" label="Who is it for?" hint="Only you see this." />
                  <fieldset className="min-w-0 space-y-2">
                    <legend className="text-ink mb-1 text-sm font-medium">Categories</legend>
                    {cats.map((c) => (
                      <CheckboxField
                        key={c}
                        name="categories"
                        value={c}
                        label={PORTFOLIO_CATEGORIES[c]}
                        defaultChecked
                      />
                    ))}
                  </fieldset>
                  <TextArea name="message" label="Note for them (optional)" rows={3} />
                  <SelectField
                    name="expires"
                    label="Link expires"
                    defaultValue="30"
                    options={[
                      { value: "7", label: "In 7 days" },
                      { value: "30", label: "In 30 days" },
                      { value: "90", label: "In 90 days" },
                      { value: "never", label: "Never" },
                    ]}
                  />
                  <SubmitButton>Create link</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Shared links" />
            <CardBody className="space-y-3">
              {links.length === 0 && (
                <EmptyState
                  icon={<Camera className="size-6" />}
                  title="No links yet"
                  description="Create one when someone asks to see your photography."
                />
              )}
              {links.map((l) => {
                const dead = Boolean(l.revokedAt) || (l.expiresAt !== null && l.expiresAt < now);
                const url = absoluteUrl(`/portfolio/${l.token}`);
                return (
                  <div key={l.id} className="border-border/70 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{l.label}</p>
                      {dead ? (
                        <Badge tone="neutral">{l.revokedAt ? "Revoked" : "Expired"}</Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted mt-1 flex items-center gap-1.5 text-xs">
                      <Eye className="size-3.5" aria-hidden /> {l.viewCount} view
                      {l.viewCount === 1 ? "" : "s"}
                      {l.lastViewedAt && ` · last ${fmtRelative(l.lastViewedAt)}`}
                      {l.expiresAt && !dead && ` · expires ${fmtDate(l.expiresAt)}`}
                    </p>
                    <p className="text-subtle mt-1 text-xs">
                      {l.categories
                        .map((c) => PORTFOLIO_CATEGORIES[c as PortfolioCategory] ?? c)
                        .join(", ")}
                    </p>
                    {!dead && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CopyButton value={url} label="Copy link" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 text-xs underline"
                        >
                          Preview
                        </a>
                        {ctx.can("leads.write") && (
                          <form action={revokePortfolioLinkAction.bind(null, l.id)}>
                            <button className="text-danger-700 text-xs hover:underline">
                              Revoke
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
