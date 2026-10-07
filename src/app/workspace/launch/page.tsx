import { CheckCircle2, Circle, CircleDashed, Lock, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Callout, Card, CardHeader, PageHeader, Progress } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { isUnlocked, launchChecklist } from "@/modules/launch/checklist";
import { toggleLaunchItemAction } from "./actions";

export const metadata: Metadata = { title: "Launch" };

export default async function LaunchPage() {
  const ctx = await requireStaff();
  const canManage = ctx.can("settings.manage");
  const groups = await launchChecklist(await getDb());
  const required = groups.flatMap((g) => g.items).filter((i) => !i.optional);
  const done = required.filter((i) => i.done).length;
  const live = groups.find((g) => g.key === "golive")?.items.every((i) => i.done);

  return (
    <>
      <PageHeader
        title="Launch"
        description="Everything between this build and www.meacreo.co.za. Automatic items read the live configuration; you tick the rest."
      />
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <Progress
          value={(done / required.length) * 100}
          label={`${done} of ${required.length} required items done`}
        />
        {live ? (
          <Badge tone="success" dot>
            Live
          </Badge>
        ) : (
          <Badge tone="warning">Not live: the Wix site is still the public website</Badge>
        )}
      </div>
      <div className="mb-6">
        <Callout tone="neutral" title="The rule">
          The current website stays live until the new one passes final QA. The domain is only
          switched once the new version works, a backup exists, assets are preserved, content is
          migrated, the move has been rehearsed and rollback is possible.
        </Callout>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        {groups.map((g) => {
          const unlocked = isUnlocked(g, groups);
          const groupDone = g.items.filter((i) => i.done).length;
          return (
            <Card key={g.key} className={g.key === "golive" ? "xl:col-span-2" : undefined}>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    {g.key === "golive" && <Rocket className="size-4" aria-hidden />}
                    {g.title}
                  </span>
                }
                description={g.description}
                action={
                  unlocked ? (
                    <Badge tone={groupDone === g.items.length ? "success" : "neutral"}>
                      {groupDone}/{g.items.length}
                    </Badge>
                  ) : (
                    <Badge>
                      <Lock className="size-3" aria-hidden /> Locked
                    </Badge>
                  )
                }
              />
              <ul className="divide-border/70 divide-y">
                {g.items.map((item) => {
                  const icon = item.done ? (
                    <CheckCircle2 className="text-success-700 size-5" aria-hidden />
                  ) : item.optional ? (
                    <CircleDashed className="text-subtle size-5" aria-hidden />
                  ) : (
                    <Circle className="text-muted size-5" aria-hidden />
                  );
                  return (
                    <li key={item.key} className="flex items-start gap-3 px-5 py-3.5">
                      {item.kind === "manual" && canManage && (unlocked || item.done) ? (
                        <form action={toggleLaunchItemAction.bind(null, item.key, !item.done)}>
                          <button
                            type="submit"
                            aria-pressed={item.done}
                            aria-label={`${item.done ? "Untick" : "Tick"} ${item.label}`}
                            className="hover:bg-surface-2 -m-1 rounded-full p-1"
                          >
                            {icon}
                          </button>
                        </form>
                      ) : (
                        <span className="pt-0.5">{icon}</span>
                      )}
                      <div className="min-w-0">
                        <p className="text-ink flex flex-wrap items-center gap-2 text-sm font-medium">
                          {item.label}
                          {item.optional && <Badge>Recommended</Badge>}
                          {item.kind === "auto" && (
                            <span className="label-mono text-subtle">auto</span>
                          )}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">{item.detail}</p>
                        {item.doneBy && item.doneAt && (
                          <p className="text-subtle mt-0.5 text-xs">
                            Ticked by {item.doneBy}, {fmtDateTime(new Date(item.doneAt))}
                          </p>
                        )}
                        {!item.done && item.href && (
                          <Link
                            href={item.href}
                            className="text-brand-700 mt-1 inline-block text-xs underline decoration-current/30"
                          >
                            Fix this
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
