import type { Metadata } from "next";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/modules/auth/context";
import { createLeadAction, importLeadsAction } from "../actions";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  await requireStaff("leads.write");
  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <PageHeader
          title="Add a lead"
          description="Qualification updates automatically as you add information and run a Visibility Report."
        />
        <Card className="p-6">
          <ActionForm action={createLeadAction} className="space-y-4">
            <TextField name="company" label="Company" required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField name="website" label="Website" placeholder="company.co.za" />
              <TextField name="industry" label="Industry" />
              <TextField name="contactName" label="Contact name" />
              <TextField name="contactRole" label="Contact role" />
              <TextField name="email" type="email" label="Email" />
              <TextField name="phone" label="Phone" />
              <TextField name="location" label="Location" />
              <SelectField
                name="employeeRange"
                label="Size"
                placeholder="Unknown"
                options={["1-10", "11-50", "51-200", "201-1000"].map((v) => ({
                  value: v,
                  label: `${v} employees`,
                }))}
              />
              <SelectField
                name="source"
                label="Source"
                options={[
                  ["manual", "Manual"],
                  ["referral", "Referral"],
                  ["linkedin", "LinkedIn"],
                  ["outreach", "Outreach"],
                ].map(([value, label]) => ({ value, label }))}
              />
              <TextField
                name="estimatedMonthly"
                label="Estimated monthly value (R)"
                inputMode="decimal"
              />
            </div>
            <TextField name="linkedinUrl" label="LinkedIn profile URL" />
            <TextArea name="goal" label="What they want to achieve" rows={2} />
            <CheckboxField
              name="consent"
              label="They agreed to be contacted"
              hint="Required before any email outreach. Recorded with a timestamp."
            />
            <CheckboxField
              name="runAudit"
              label="Run a Visibility Report on their website now"
              defaultChecked
            />
            <SubmitButton>Add lead</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <Card className="h-fit lg:mt-[4.5rem]">
        <CardHeader
          title="Import from CSV"
          description="Header row: company, website, contact_name, email, industry, location. Up to 1,000 rows."
        />
        <CardBody>
          <ActionForm action={importLeadsAction} className="space-y-3">
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              className="file:bg-brand-50 file:text-brand-800 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2"
            />
            <p className="text-muted text-xs">
              Only import contacts you have a lawful basis to contact (POPIA/GDPR). Imported leads
              have no consent recorded.
            </p>
            <SubmitButton variant="secondary" size="sm">
              Import
            </SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
