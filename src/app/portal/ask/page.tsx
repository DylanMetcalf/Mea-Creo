import type { Metadata } from "next";
import { AskBox } from "@/components/portal/ask-box";
import { requireClient } from "@/modules/auth/context";
import { portalAskAction } from "../actions";

export const metadata: Metadata = { title: "Ask Mea Creo" };

export default async function PortalAsk() {
  await requireClient();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Ask Mea Creo</h1>
        <p className="text-muted mt-1">
          Quick answers about your account: services, progress, approvals, reports, meetings and
          billing.
        </p>
      </header>
      <AskBox action={portalAskAction} />
      <div className="rounded-card bg-surface-2 text-ink-soft p-4 text-sm">
        <p className="text-ink font-medium">How this works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Answers use only your organisation&apos;s information that you can already see in this
            portal.
          </li>
          <li>
            It doesn&apos;t make promises about rankings, leads or results, and it can&apos;t change
            anything on your account.
          </li>
          <li>For decisions, changes or anything sensitive, message the team.</li>
        </ul>
      </div>
    </div>
  );
}
