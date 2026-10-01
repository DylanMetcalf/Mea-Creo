import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/form";
import { Callout, Card, CardBody, DescriptionList } from "@/components/ui/primitives";
import { resolveIntegration } from "@/integrations/registry";
import { isCurrency, money, formatMoney } from "@/lib/money";
import { simulatePaymentAction } from "./actions";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

const FIELDS = [
  "reference",
  "amount_minor",
  "currency",
  "description",
  "email",
  "return_url",
  "cancel_url",
  "frequency",
];

export default async function TestCheckoutPage({ searchParams }: PageProps<"/pay/test-checkout">) {
  const payments = resolveIntegration("payments");
  if (!payments.available || !payments.adapter.isMock) notFound();
  const params = await searchParams;
  const value = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const currency = value("currency");
  const amount = Number(value("amount_minor"));
  const display =
    Number.isSafeInteger(amount) && isCurrency(currency)
      ? formatMoney(money(amount, currency))
      : "-";
  return (
    <div className="mx-auto max-w-lg">
      <Callout tone="warning" title="Test checkout: no real money moves">
        Payments are not connected yet, so this simulated checkout stands in for Payfast. It sends a
        signed test notification through the same code path a real payment uses.
      </Callout>
      <Card className="mt-6">
        <CardBody className="space-y-5">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-brand-700 size-6" aria-hidden />
            <div>
              <p className="text-muted text-sm">{value("description")}</p>
              <p className="text-2xl font-semibold tabular-nums">{display}</p>
            </div>
          </div>
          <DescriptionList
            items={[
              ["Payer", value("email")],
              ["Type", value("frequency") ? "Subscription" : "Once-off"],
            ]}
          />
          <form action={simulatePaymentAction} className="flex flex-wrap gap-2">
            {FIELDS.map((k) => (
              <input key={k} type="hidden" name={k} value={value(k)} />
            ))}
            <SubmitButton name="outcome" value="success">
              Simulate successful payment
            </SubmitButton>
            <SubmitButton name="outcome" value="failure" variant="secondary">
              Simulate failure
            </SubmitButton>
            <SubmitButton name="outcome" value="cancel" variant="ghost">
              Cancel
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
