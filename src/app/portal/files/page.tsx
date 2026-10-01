import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { fmtDate, humanize } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { listDocuments, MAX_UPLOAD_BYTES } from "@/modules/documents/service";
import { portalUploadAction } from "../actions";

export const metadata: Metadata = { title: "Files" };

export default async function PortalFiles() {
  const ctx = await requireClient();
  const docs = await listDocuments(await getDb(), ctx.organisationId, { clientOnly: true });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Files</h1>
        <p className="text-muted mt-1">
          Brand assets, documents and photos you share with us, and files we share with you.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {docs.length === 0 ? (
          <EmptyState icon={<FileText className="size-6" />} title="No files yet" />
        ) : (
          <Card>
            <ul className="divide-border divide-y">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{d.name}</span>
                    <span className="text-muted block text-xs">
                      {humanize(d.category)} · {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                      {fmtDate(d.createdAt)}
                      {d.version > 1 ? ` · version ${d.version}` : ""}
                    </span>
                  </span>
                  <a
                    href={`/api/documents/${d.id}`}
                    className="text-brand-700 hover:bg-surface-2 rounded-md p-2"
                    aria-label={`Download ${d.name}`}
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {ctx.can("portal.upload") && (
          <Card className="h-fit">
            <CardHeader
              title="Upload"
              description={`Up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Images, PDFs, Office documents, videos.`}
            />
            <CardBody>
              <ActionForm action={portalUploadAction} className="space-y-3" resetOnSuccess>
                <div>
                  <label htmlFor="file" className="mb-1 block text-sm font-medium">
                    File
                  </label>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    required
                    className="file:bg-brand-50 file:text-brand-800 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2"
                  />
                </div>
                <SelectField
                  name="category"
                  label="What is it?"
                  options={[
                    "logo",
                    "brand_guidelines",
                    "image",
                    "video",
                    "document",
                    "contract",
                  ].map((c) => ({ value: c, label: humanize(c) }))}
                />
                <TextField name="description" label="Note (optional)" />
                <SubmitButton>Upload</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
