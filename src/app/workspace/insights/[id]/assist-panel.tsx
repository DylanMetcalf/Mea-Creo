"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonClass } from "@/components/ui/button";
import { blogAssistAction } from "../actions";

const NEW_MODES = [
  ["outline", "Outline"],
  ["draft", "Full draft"],
  ["expand", "Expand my notes"],
] as const;
const EDIT_MODES = [
  ["improve", "Improve this draft"],
  ["seo", "SEO title, description, links & CTA"],
  ["visual_brief", "Featured-image brief"],
] as const;

const field =
  "border-border-strong bg-surface w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600";

/**
 * AI assistant for blog posts. New-article modes create a DRAFT and open it; the other modes
 * return suggestions to copy. Nothing is published from here.
 */
export function AssistPanel({
  insightId,
  aiConnected,
  defaultTopic,
}: {
  insightId?: string;
  aiConnected: boolean;
  defaultTopic?: string;
}) {
  const modes = insightId ? EDIT_MODES : NEW_MODES;
  const [mode, setMode] = useState<string>(insightId ? "seo" : "outline");
  const [state, action, pending] = useActionState(blogAssistAction, null);
  const output = typeof state?.data?.output === "string" ? state.data.output : null;
  return (
    <section
      className="rounded-card border-border bg-surface mt-6 border p-5"
      aria-labelledby="assist-h"
    >
      <h2 id="assist-h" className="flex items-center gap-2 font-semibold">
        <Sparkles className="text-brand-600 size-4" aria-hidden /> Writing assistant
      </h2>
      <p className="text-muted mt-1 text-sm">
        {aiConnected
          ? "Uses the Content agent within your AI budget. Results are drafts: check every claim (look for [VERIFY]) before publishing."
          : "AI isn't connected, so only the outline template works. Connect an AI provider to draft, expand and improve."}
      </p>
      <form action={action} className="mt-4 space-y-3">
        {insightId && <input type="hidden" name="insightId" value={insightId} />}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">What should the assistant do?</legend>
          {modes.map(([value, label]) => (
            <label
              key={value}
              className="border-border has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="accent-brand-700"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            Topic
            <input name="topic" required defaultValue={defaultTopic} className={field} />
          </label>
          <label className="text-sm">
            Audience
            <input
              name="audience"
              placeholder="e.g. owners of engineering firms"
              className={field}
            />
          </label>
          <label className="text-sm">
            Purpose
            <input name="purpose" placeholder="e.g. explain GEO without jargon" className={field} />
          </label>
          <label className="text-sm">
            Call to action
            <input
              name="cta"
              placeholder="e.g. request a free Visibility Report"
              className={field}
            />
          </label>
          <label className="text-sm">
            Tone
            <input name="tone" placeholder="friendly, practical" className={field} />
          </label>
          <label className="text-sm">
            Length
            <select name="length" defaultValue="medium" className={field}>
              <option value="short">Short (600-800 words)</option>
              <option value="medium">Medium (1,000-1,400 words)</option>
              <option value="long">Long (1,800-2,400 words)</option>
            </select>
          </label>
        </div>
        {mode === "expand" && (
          <label className="block text-sm">
            Your notes
            <textarea name="notes" rows={6} required className={field} />
          </label>
        )}
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "Working…" : insightId ? "Get suggestions" : "Create draft"}
        </button>
        {state?.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={state.ok ? "text-sm" : "text-danger-700 text-sm"}
          >
            {state.message}
          </p>
        )}
        {state?.fieldErrors?.topic && (
          <p role="alert" className="text-danger-700 text-sm">
            {state.fieldErrors.topic[0]}
          </p>
        )}
      </form>
      {output && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-end">
            <CopyButton value={output} />
          </div>
          <pre className="bg-surface-2 max-h-[480px] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </section>
  );
}
