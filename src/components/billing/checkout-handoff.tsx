"use client";

import { useEffect, useRef } from "react";

/**
 * Hands the browser over to the payment provider by submitting a hidden form with the
 * provider's fields (POST for Payfast's signed checkout, GET query for the test checkout).
 */
export function CheckoutHandoff({
  url,
  method,
  fields,
}: {
  url: string;
  method: "GET" | "POST";
  fields: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.submit();
  }, [url, method]);
  return (
    <form ref={form} action={url} method={method === "POST" ? "post" : "get"} className="mt-3">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <p className="text-muted text-sm" role="status">
        Taking you to secure checkout…{" "}
        <button type="submit" className="text-brand-700 underline">
          Continue
        </button>
      </p>
    </form>
  );
}
