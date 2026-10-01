"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import type { ActionState } from "@/lib/actions";

interface Answer {
  question: string;
  answer: string;
  sources: { label: string; href: string }[];
  source: "ai" | "rules";
  suggestions: string[];
}

const STARTERS = [
  "What is Mea Creo doing for us?",
  "What needs my approval?",
  "What happened this month?",
  "What happens next?",
];

/** "Ask Mea Creo": answers come only from this organisation's client-visible data, with sources. */
export function AskBox({
  action,
  compact = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [value, setValue] = useState("");
  const answer = state?.ok ? (state.data as unknown as Answer | undefined) : undefined;
  return (
    <section
      aria-labelledby="ask-heading"
      className="rounded-card border-brand-100 bg-brand-50 border p-4 sm:p-5"
    >
      <h2 id="ask-heading" className="text-brand-800 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4" aria-hidden /> Ask Mea Creo
      </h2>
      <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask-q" className="sr-only">
          Your question
        </label>
        <input
          id="ask-q"
          name="question"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          placeholder="e.g. What has improved this month?"
          className="border-border-strong bg-surface h-11 flex-1 rounded-lg border px-3 text-sm"
        />
        <SubmitButton pendingLabel="Thinking…">Ask</SubmitButton>
      </form>
      {!answer && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(compact ? STARTERS.slice(0, 3) : STARTERS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="border-border bg-surface text-ink-soft hover:border-brand-300 rounded-full border px-3 py-1 text-xs"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {state?.ok === false && state.message && (
        <div className="mt-3">
          <FormMessage tone="error">{state.message}</FormMessage>
        </div>
      )}
      {answer && (
        <div className="bg-surface mt-4 rounded-lg p-4" aria-live="polite">
          <p className="text-muted text-xs">You asked: {answer.question}</p>
          <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
            {answer.answer}
          </p>
          {answer.sources.length > 0 && (
            <p className="text-muted mt-3 text-xs">
              Based on:{" "}
              {answer.sources.map((s, i) => (
                <span key={s.href + s.label}>
                  {i > 0 && " · "}
                  <Link href={s.href} className="text-brand-700 hover:underline">
                    {s.label}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <p className="text-subtle mt-2 text-[0.7rem]">
            Answers use only your account&apos;s information. For anything else, message the team.
          </p>
          {answer.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue(s)}
                  className="border-border text-ink-soft hover:border-brand-300 rounded-full border px-3 py-1 text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
