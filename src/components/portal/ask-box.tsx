"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
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
  "What changed this month?",
  "What should we focus on next?",
  "Explain my Visibility Index",
  "What needs my approval?",
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
  const formRef = useRef<HTMLFormElement>(null);
  // A suggested question is asked straight away.
  const ask = (q: string) => {
    setValue(q);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };
  const answer = state?.ok ? (state.data as unknown as Answer | undefined) : undefined;
  return (
    <section
      aria-labelledby="ask-heading"
      className="edge-glow from-brand-50 via-surface to-dusk-100/60 shadow-card relative overflow-hidden rounded-[18px] bg-gradient-to-br p-4 sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-signal shadow-glow flex size-7 items-center justify-center rounded-lg text-white">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <h2 id="ask-heading" className="font-display text-ink text-[1.05rem]">
          Ask Mea Creo
        </h2>
        <span className="label-mono text-subtle ml-auto hidden sm:inline">
          Answers from your account only
        </span>
      </div>
      <form ref={formRef} action={formAction} className="mt-3.5 flex flex-col gap-2 sm:flex-row">
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
          className="border-border bg-surface focus:border-brand-400 focus:ring-brand-100 h-11 w-full rounded-xl border px-3.5 text-sm shadow-[inset_0_1px_2px_rgb(14_25_21/0.04)] transition focus:ring-4 focus:outline-none sm:flex-1"
        />
        <SubmitButton pendingLabel="Thinking…">Ask</SubmitButton>
      </form>
      {!answer && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(compact ? STARTERS.slice(0, 3) : STARTERS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="border-border bg-surface/80 text-ink-soft hover:border-brand-300 hover:text-brand-800 rounded-full border px-3 py-1.5 text-xs transition-colors"
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
        <div
          className="bg-surface border-border/70 mt-4 rounded-xl border p-4 motion-safe:animate-[rise_.3s_var(--ease-out)]"
          aria-live="polite"
        >
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
                  <Link
                    href={s.href}
                    className="text-brand-700 decoration-brand-300 underline underline-offset-[3px] hover:decoration-current"
                  >
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
                  onClick={() => ask(s)}
                  className="border-border text-ink-soft hover:border-brand-300 hover:text-brand-800 rounded-full border px-3 py-1.5 text-xs transition-colors"
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
