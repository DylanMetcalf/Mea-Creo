import { Send, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Table } from "@/components/ui/feedback";
import {
  ActionForm,
  FileDropField,
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
  Progress,
} from "@/components/ui/primitives";
import { getDb } from "@/db";
import { fmtDate, humanize } from "@/lib/format";
import type { ClientDetail } from "@/modules/clients/queries";
import {
  getProgramme,
  listProspects,
  QUOTA_MAX,
  QUOTA_MIN,
  weekProgress,
} from "@/modules/prospecting/service";
import {
  addProspectAction,
  importProspectsAction,
  releaseProspectsAction,
  removeProspectAction,
  saveProspectProgrammeAction,
} from "../actions";

/** Workspace side of the "Fresh prospects" client service. */
export async function ProspectsTab({
  data,
  canManage,
}: {
  data: ClientDetail;
  canManage: boolean;
}) {
  const { client } = data;
  if (client.isInternal)
    return (
      <EmptyState
        icon={<Users className="size-5" />}
        title="Fresh prospects is a client service"
        description="Mea Creo's own prospecting runs from Leads & pipeline, without a paid data provider."
        action={
          <Link href="/workspace/leads" className="text-brand-700 text-sm font-medium underline">
            Go to Leads & pipeline
          </Link>
        }
      />
    );

  const db = await getDb();
  const orgId = client.organisationId;
  const [programme, prospects, progress] = await Promise.all([
    getProgramme(db, orgId),
    listProspects(db, orgId),
    weekProgress(db, orgId),
  ]);
  const c = programme?.criteria;
  const quota = programme?.weeklyQuota ?? 10;
  const unreleased = prospects.filter((p) => !p.releasedAt).length;
  const weeks = [...new Set(prospects.map((p) => p.weekOf))];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        {programme?.status === "active" && (
          <Card>
            <CardHeader
              title={`This week (from ${fmtDate(progress.weekOf)})`}
              description={`${progress.added} of ${quota} researched · ${progress.released} released to the client`}
              action={
                unreleased > 0 ? (
                  <form action={releaseProspectsAction.bind(null, orgId)}>
                    <SubmitButton size="sm" pendingLabel="Releasing…">
                      <Send className="size-4" aria-hidden /> Release {unreleased} to portal
                    </SubmitButton>
                  </form>
                ) : undefined
              }
            />
            <CardBody>
              <Progress value={(progress.added / quota) * 100} label="Weekly quota" />
              <p className="text-muted mt-3 text-xs">
                Review each prospect before releasing: the client sees the reason and source for
                every one.
              </p>
            </CardBody>
          </Card>
        )}

        {weeks.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No prospects yet"
            description={
              programme
                ? "Add prospects one at a time or import a CSV. They stay internal until you release them."
                : "Set up the service on the right first."
            }
          />
        ) : (
          weeks.map((week) => {
            const rows = prospects.filter((p) => p.weekOf === week);
            return (
              <section key={week} className="space-y-2">
                <h3 className="label-mono text-muted">
                  Week of {fmtDate(week)} · {rows.length}
                </h3>
                <Table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Why a fit</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id} className="align-top">
                        <td className="min-w-40">
                          <p className="font-medium">{p.company}</p>
                          <p className="text-muted text-xs">
                            {[p.industry, p.location].filter(Boolean).join(" · ")}
                          </p>
                          {p.website && (
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-700 text-xs underline decoration-current/30"
                            >
                              {p.website.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          )}
                        </td>
                        <td className="min-w-36 text-xs">
                          {p.contactName ? (
                            <>
                              <p className="text-sm">{p.contactName}</p>
                              <p className="text-muted">{p.contactRole}</p>
                              <p className="text-muted break-all">{p.email ?? p.phone}</p>
                            </>
                          ) : (
                            <span className="text-muted">Company only</span>
                          )}
                        </td>
                        <td className="min-w-56 text-xs">
                          <p className="text-ink-soft text-sm">{p.reason}</p>
                          <p className="text-muted mt-1">Source: {p.source}</p>
                        </td>
                        <td>
                          {p.releasedAt ? (
                            <Badge tone={p.status === "won" ? "success" : "brand"}>
                              {humanize(p.status)}
                            </Badge>
                          ) : (
                            <Badge tone="warning">In review</Badge>
                          )}
                          {p.clientNote && (
                            <p className="text-muted mt-1 max-w-40 text-xs">
                              &ldquo;{p.clientNote}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="text-right">
                          {!p.releasedAt && (
                            <form action={removeProspectAction.bind(null, orgId, p.id)}>
                              <button
                                type="submit"
                                aria-label={`Remove ${p.company}`}
                                className="text-muted hover:text-danger-700 rounded-md p-1.5"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            );
          })
        )}
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader
            title="Fresh prospects"
            description="A paid weekly service: researched companies that match this client's ideal customer, delivered to their portal."
            action={
              programme ? (
                <Badge tone={programme.status === "active" ? "success" : "neutral"} dot>
                  {programme.status === "active" ? "Active" : "Paused"}
                </Badge>
              ) : (
                <Badge>Off</Badge>
              )
            }
          />
          <CardBody>
            <ActionForm action={saveProspectProgrammeAction} className="space-y-4">
              <input type="hidden" name="organisationId" value={orgId} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  name="status"
                  label="Status"
                  defaultValue={programme?.status ?? "active"}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                  ]}
                  disabled={!canManage}
                />
                <TextField
                  name="weeklyQuota"
                  type="number"
                  min={QUOTA_MIN}
                  max={QUOTA_MAX}
                  label="Per week"
                  defaultValue={String(quota)}
                  hint="Usually 10–20."
                  disabled={!canManage}
                />
              </div>
              <TextArea
                name="industries"
                label="Target industries"
                rows={3}
                defaultValue={c?.industries.join("\n") ?? client.industry ?? ""}
                hint="One per line."
                disabled={!canManage}
              />
              <TextArea
                name="locations"
                label="Locations"
                rows={2}
                defaultValue={c?.locations.join("\n") ?? client.location ?? ""}
                disabled={!canManage}
              />
              <TextArea
                name="roles"
                label="Decision-maker roles"
                rows={2}
                defaultValue={c?.roles.join("\n") ?? ""}
                disabled={!canManage}
              />
              <TextArea
                name="companySizes"
                label="Company sizes (employees)"
                rows={2}
                defaultValue={c?.companySizes.join("\n") ?? ""}
                disabled={!canManage}
              />
              <TextArea
                name="notes"
                label="Notes and exclusions"
                rows={3}
                defaultValue={c?.notes ?? ""}
                hint="Existing customers to avoid, competitors, anything else."
                disabled={!canManage}
              />
              {canManage && <SubmitButton>{programme ? "Save" : "Start the service"}</SubmitButton>}
            </ActionForm>
            <p className="text-muted mt-4 text-xs">
              Priced on request: agree the fee with the client and add it under Services. Automated
              sourcing from a data provider{" "}
              <span className="text-ink font-medium">requires configuration</span>; until then the
              team researches prospects and adds them here.
            </p>
          </CardBody>
        </Card>

        {programme && (
          <Card>
            <CardHeader
              title="Add a prospect"
              description="Added to this week's batch, in review."
            />
            <CardBody>
              <ActionForm action={addProspectAction} className="space-y-3">
                <input type="hidden" name="organisationId" value={orgId} />
                <TextField name="company" label="Company" required />
                <TextField name="website" label="Website" inputMode="url" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField name="industry" label="Industry" />
                  <TextField name="location" label="Location" />
                  <TextField name="contactName" label="Contact name" />
                  <TextField name="contactRole" label="Role" />
                </div>
                <TextField name="email" label="Business email" type="email" />
                <TextField name="phone" label="Business phone" />
                <TextField name="linkedinUrl" label="LinkedIn URL" />
                <TextArea name="reason" label="Why they fit" rows={2} required />
                <TextField
                  name="source"
                  label="Source"
                  required
                  hint="Where the details came from, e.g. their website's contact page."
                />
                <SubmitButton size="sm">Add prospect</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}

        {programme && (
          <Card>
            <CardHeader
              title="Import a batch"
              description="CSV with columns: company, website, industry, location, contact name, role, email, phone, linkedin, reason, source."
            />
            <CardBody>
              <ActionForm action={importProspectsAction} className="space-y-3">
                <input type="hidden" name="organisationId" value={orgId} />
                <FileDropField name="csv" label="CSV file" accept=".csv,text/csv" />
                <SubmitButton size="sm" variant="secondary">
                  Import
                </SubmitButton>
              </ActionForm>
              <p className="text-muted mt-3 text-xs">
                Use business contact details from public, professional sources only. Companies
                already delivered to {client.name} are skipped. Rows without a reason or source are
                rejected.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
