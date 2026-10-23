"use client";

import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/ui/form";
import { subscribeAction } from "@/app/(site)/newsletter/actions";
import type { NewsletterTopic } from "@/db/schema";

// Kept here (not imported from the schema) so no database code reaches the browser.
const TOPIC_LABELS: Record<NewsletterTopic, string> = {
  search_visibility: "Search & AI visibility",
  linkedin: "LinkedIn",
  lead_generation: "Lead generation",
  social_media: "Social media",
  photo_video: "Photography & video",
  automation: "AI & automation",
};

/** Newsletter sign-up. Consent is explicit and recorded; topics are optional. */
export function NewsletterForm({ source }: { source: string }) {
  return (
    <ActionForm action={subscribeAction} className="space-y-4" resetOnSuccess>
      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden>
        <label>
          Leave this empty
          <input type="text" name="company_website_confirm" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="email" type="email" label="Email" autoComplete="email" required />
        <TextField name="name" label="First name (optional)" autoComplete="given-name" />
      </div>
      <fieldset>
        <legend className="text-ink text-sm font-medium">
          What would you like to hear about? <span className="text-muted">(optional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(TOPIC_LABELS) as NewsletterTopic[]).map((t) => (
            <label
              key={t}
              className="border-border has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="topics"
                value={t}
                className="accent-brand-700 size-3.5"
              />
              {TOPIC_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <CheckboxField
        name="consent"
        label="Send me Mea Creo's newsletter. I can unsubscribe at any time with the link in every email."
      />
      <SubmitButton>Subscribe</SubmitButton>
    </ActionForm>
  );
}
