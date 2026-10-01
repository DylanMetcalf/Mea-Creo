"use client";

import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { requestReportAction } from "./actions";

const SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-1000", label: "201+ employees" },
];

export function ReportForm({ utm }: { utm: Record<string, string> }) {
  return (
    <ActionForm action={requestReportAction} className="space-y-4">
      {Object.entries(utm).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="hidden" aria-hidden>
        <label>
          Leave this empty
          <input type="text" name="company_website_confirm" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField
        name="website"
        label="Your website"
        placeholder="yourcompany.co.za"
        required
        autoComplete="url"
        inputMode="url"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="name" label="Your name" required autoComplete="name" />
        <TextField name="company" label="Company" required autoComplete="organization" />
      </div>
      <TextField
        name="email"
        type="email"
        label="Work email"
        required
        autoComplete="email"
        hint="We'll email you a link to your report."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="industry" label="Industry" placeholder="e.g. Engineering" />
        <TextField name="location" label="Location" placeholder="e.g. Pretoria" />
      </div>
      <SelectField
        name="employeeRange"
        label="Company size"
        options={SIZES}
        placeholder="Select (optional)"
      />
      <TextArea
        name="goal"
        label="What would you most like to improve? (optional)"
        rows={2}
        placeholder="e.g. More enquiries from Google"
      />
      <CheckboxField
        name="consent"
        label="I agree that Mea Creo may store these details to prepare my report and contact me about it."
        hint="See our privacy policy. We never sell your details."
      />
      <CheckboxField
        name="marketingOptIn"
        label="Send me occasional practical insights (optional)."
      />
      <SubmitButton size="lg" className="w-full" pendingLabel="Starting your report…">
        Get my Visibility Report
      </SubmitButton>
    </ActionForm>
  );
}
