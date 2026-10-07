"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { useFormState } from "@/components/ui/form";

/**
 * Day tabs + time buttons; submits the chosen slot as an ISO string in `name`.
 * Times are shown in the booking time zone.
 */
export function SlotPicker({
  days,
  timezone,
  name = "slot",
}: {
  days: { date: string; slots: string[] }[];
  timezone: string;
  name?: string;
}) {
  const withSlots = days.filter((d) => d.slots.length);
  const [day, setDay] = useState(withSlots[0]?.date);
  const [slot, setSlot] = useState<string>();
  const state = useFormState();
  const error = state?.fieldErrors?.[name]?.[0];
  if (!withSlots.length)
    return (
      <p className="text-muted text-sm">
        No times available in the next few weeks. Please send us a message instead.
      </p>
    );
  const current = withSlots.find((d) => d.date === day) ?? withSlots[0];
  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">
        Choose a time ({timezone.replace("_", " ")})
      </legend>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Days">
        {withSlots.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={d.date === current.date}
            onClick={() => {
              setDay(d.date);
              setSlot(undefined);
            }}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 text-sm whitespace-nowrap",
              d.date === current.date
                ? "border-brand-700 bg-brand-50 text-brand-800 font-medium"
                : "border-border bg-surface hover:border-brand-300",
            )}
          >
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {current.slots.map((s) => (
          <label
            key={s}
            className={cn(
              "cursor-pointer rounded-lg border px-2 py-2 text-center text-sm tabular-nums",
              slot === s
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface hover:border-brand-300",
            )}
          >
            <input
              type="radio"
              name={name}
              value={s}
              checked={slot === s}
              onChange={() => setSlot(s)}
              className="sr-only"
            />
            {time(s)}
          </label>
        ))}
      </div>
      {error && (
        <p className="text-danger-700 mt-2 text-sm" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
