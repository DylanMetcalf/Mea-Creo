"use client";

import { SlotPicker } from "@/components/booking/slot-picker";
import { ActionForm, CheckboxField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { bookCallAction } from "./actions";

export function BookingForm({
  days,
  timezone,
  reportToken,
}: {
  days: { date: string; slots: string[] }[];
  timezone: string;
  reportToken?: string;
}) {
  return (
    <ActionForm action={bookCallAction} className="space-y-5">
      <div className="hidden" aria-hidden>
        <label>
          Leave this empty
          <input type="text" name="company_website_confirm" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {reportToken && <input type="hidden" name="reportToken" value={reportToken} />}
      <SlotPicker days={days} timezone={timezone} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" required />
        <TextField name="email" type="email" label="Email" autoComplete="email" required />
        <TextField name="company" label="Company" autoComplete="organization" required />
        <TextField name="phone" label="Phone (optional)" autoComplete="tel" />
      </div>
      <TextField name="website" label="Website (optional)" inputMode="url" />
      <TextArea name="notes" label="Anything we should know before the call? (optional)" rows={3} />
      <CheckboxField
        name="consent"
        label="Mea Creo may contact me about this call. See the privacy policy."
      />
      <SubmitButton size="lg">Book the call</SubmitButton>
    </ActionForm>
  );
}
