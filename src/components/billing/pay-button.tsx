"use client";

import { CreditCard } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import type { CheckoutRedirect } from "@/integrations/payments/types";
import type { ActionState } from "@/lib/actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { CheckoutHandoff } from "./checkout-handoff";

/** Starts checkout through a Server Action, then hands over to the provider. */
export function PayButton({
  action,
  children,
  label = "Pay now",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const checkout = state?.data?.checkout as CheckoutRedirect | undefined;
  return (
    <div>
      <form action={formAction}>
        {children}
        {state?.ok === false && state.message && (
          <FormMessage tone="error">{state.message}</FormMessage>
        )}
        <SubmitButton pendingLabel="Preparing checkout…">
          <CreditCard className="size-4" aria-hidden /> {label}
        </SubmitButton>
      </form>
      {checkout && <CheckoutHandoff {...checkout} />}
    </div>
  );
}
