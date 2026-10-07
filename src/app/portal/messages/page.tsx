import { and, asc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionForm, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { portalMessageAction } from "../actions";

export const metadata: Metadata = { title: "Messages" };

export default async function PortalMessages() {
  const ctx = await requireClient();
  const db = await getDb();
  const rows = await db
    .select({ m: messages, author: users.name })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(eq(messages.organisationId, ctx.organisationId))
    .orderBy(asc(messages.createdAt))
    .limit(200);
  await db
    .update(messages)
    .set({ readByClientAt: new Date() })
    .where(
      and(
        eq(messages.organisationId, ctx.organisationId),
        eq(messages.fromClient, false),
        isNull(messages.readByClientAt),
      ),
    );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Messages</h1>
        <p className="text-muted mt-1">
          Talk to the Mea Creo team. We usually reply within one working day.
        </p>
      </header>
      <Card>
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto p-4 sm:p-5" aria-label="Conversation">
          {rows.length === 0 && <li className="text-muted text-sm">No messages yet. Say hello.</li>}
          {rows.map(({ m, author }) => (
            <li key={m.id} className={`flex ${m.fromClient ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromClient ? "bg-accent text-white" : "bg-surface-2 text-ink"}`}
              >
                {m.kind === "support" && (
                  <p className="mb-1 text-[0.7rem] font-semibold uppercase opacity-80">
                    Support request
                  </p>
                )}
                {m.subject && <p className="font-medium">{m.subject}</p>}
                <p className="whitespace-pre-line">{m.body}</p>
                <p
                  className={`mt-1 text-[0.7rem] ${m.fromClient ? "text-white/75" : "text-muted"}`}
                >
                  {author ?? (m.fromClient ? "You" : "Mea Creo")} · {fmtDateTime(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <CardBody className="border-border border-t">
          <ActionForm action={portalMessageAction} className="space-y-3" resetOnSuccess>
            <TextArea name="body" label="Message" rows={3} required />
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                name="kind"
                label="Type"
                options={[
                  { value: "message", label: "Message" },
                  { value: "support", label: "Support request" },
                ]}
              />
              <SubmitButton>Send</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
