import type { ActionState } from "@/lib/actions";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";

/** Approve / request changes / reject, with an optional comment. Shared by workspace and portal. */
export function DecisionForm({
  action,
  approvalId,
  approveLabel = "Approve",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  approvalId: string;
  approveLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3">
      <input type="hidden" name="approvalId" value={approvalId} />
      <TextArea name="comment" label="Comment (required for changes or rejection)" rows={3} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approved">
          {approveLabel}
        </SubmitButton>
        <SubmitButton name="decision" value="changes_requested" variant="secondary">
          Request changes
        </SubmitButton>
        <SubmitButton name="decision" value="rejected" variant="ghost">
          Reject
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
