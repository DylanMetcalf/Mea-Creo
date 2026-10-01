"use client";

import { ActionForm, CheckboxField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { contactAction } from "./actions";

export function ContactForm() {
  return (
    <ActionForm action={contactAction} className="space-y-4" resetOnSuccess>
      <div className="hidden" aria-hidden>
        <label>
          Leave this empty
          <input type="text" name="company_website_confirm" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" required />
        <TextField name="email" type="email" label="Email" autoComplete="email" required />
        <TextField name="company" label="Company" autoComplete="organization" required />
        <TextField name="phone" label="Phone (optional)" autoComplete="tel" />
      </div>
      <TextField name="website" label="Website (optional)" inputMode="url" />
      <TextArea name="message" label="How can we help?" rows={5} required />
      <CheckboxField
        name="consent"
        label="Mea Creo may contact me about this enquiry. See the privacy policy."
      />
      <SubmitButton size="lg">Send message</SubmitButton>
    </ActionForm>
  );
}
