import type { Metadata } from "next";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { requireStaff } from "@/modules/auth/context";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage() {
  await requireStaff("clients.write");
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Add a client"
        description="Creates the client workspace with an onboarding checklist. You can add services, invite portal users and run the first audit next."
      />
      <Card className="p-6">
        <ActionForm action={createClientAction} className="space-y-5">
          <TextField name="name" label="Company name" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="website" label="Website" placeholder="company.co.za" />
            <TextField name="industry" label="Industry" />
            <TextField name="location" label="Location" placeholder="City, province" />
            <SelectField
              name="employeeRange"
              label="Company size"
              placeholder="Select"
              options={["1-10", "11-50", "51-200", "201-1000"].map((v) => ({
                value: v,
                label: `${v} employees`,
              }))}
            />
            <SelectField
              name="country"
              label="Country"
              defaultValue="ZA"
              options={[
                ["ZA", "South Africa"],
                ["GB", "United Kingdom"],
                ["US", "United States"],
                ["AU", "Australia"],
                ["CA", "Canada"],
                ["DE", "Germany"],
                ["NL", "Netherlands"],
              ].map(([value, label]) => ({ value, label }))}
            />
            <SelectField
              name="currency"
              label="Billing currency"
              defaultValue="ZAR"
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <TextArea name="description" label="What they do" rows={3} />
          <fieldset className="rounded-card border-border space-y-4 border p-4">
            <legend className="px-1 text-sm font-medium">Primary contact (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="contactName" label="Name" />
              <TextField name="contactEmail" type="email" label="Email" />
              <TextField name="contactRole" label="Role" />
            </div>
          </fieldset>
          <SubmitButton>Create client</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
