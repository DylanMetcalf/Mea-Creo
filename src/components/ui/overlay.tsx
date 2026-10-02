"use client";

import { CheckCircle2, ChevronDown, Info, X, XCircle } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Modal and drawer on the native <dialog> element: focus is trapped, Escape closes,
 * and the page behind is inert, all handled by the browser.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = () => onClose();
    d.addEventListener("close", onCancel);
    return () => d.removeEventListener("close", onCancel);
  }, [onClose]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="bg-elevated shadow-lifted backdrop:bg-night/45 m-auto w-[min(92vw,30rem)] rounded-2xl p-0 backdrop:backdrop-blur-[3px] open:motion-safe:animate-[pop-in_.2s_var(--ease-out)]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-ink text-[1.25rem]">{title}</h2>
            {description && <p className="text-muted mt-1 text-sm">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:bg-surface-2 hover:text-ink -m-1 rounded-lg p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>
        {children && <div className="text-ink-soft mt-4 text-sm">{children}</div>}
      </div>
      {footer && (
        <div className="border-border/70 bg-surface-2 flex justify-end gap-2 border-t px-6 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
}) {
  const ref = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="bg-elevated backdrop:bg-night/40 fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(92vw,26rem)] max-w-none p-0 shadow-[-20px_0_60px_-20px_rgb(8_19_15/0.35)] backdrop:backdrop-blur-[2px] open:motion-safe:animate-[drawer-in_.25s_var(--ease-out)]"
    >
      <div className="border-border/70 flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-display text-[1.1rem]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-subtle hover:bg-surface-2 hover:text-ink rounded-lg p-1.5"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-5 text-sm">{children}</div>
    </dialog>
  );
}

/** Button with a menu of actions. Closes on outside click and Escape. */
export function Dropdown({
  label,
  items,
}: {
  label: ReactNode;
  items: { label: ReactNode; onSelect?: () => void; href?: string; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-border-strong bg-surface shadow-card hover:border-brand-400 inline-flex h-10 items-center gap-2 rounded-[11px] border px-4 text-sm font-medium transition-colors"
      >
        {label}
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          role="menu"
          className="border-border bg-elevated shadow-lifted absolute left-0 z-40 mt-2 min-w-48 rounded-xl border p-1.5 motion-safe:animate-[pop-in_.15s_var(--ease-out)]"
        >
          {items.map((item, i) =>
            item.href ? (
              <a
                key={i}
                role="menuitem"
                href={item.href}
                className="hover:bg-brand-50 block rounded-lg px-3 py-2 text-sm"
              >
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm",
                  item.danger ? "text-danger-700 hover:bg-danger-100" : "hover:bg-brand-50",
                )}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Shows a short confirmation. Call from any client component: toast("Saved"). */
export function toast(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(new CustomEvent("mc:toast", { detail: { message, tone } }));
}

/** Mount once per layout. Announces politely to screen readers. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { message, tone } = (e as CustomEvent<{ message: string; tone: ToastTone }>).detail;
      const id = ++n;
      setItems((list) => [...list, { id, message, tone }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4200);
    };
    window.addEventListener("mc:toast", onToast);
    return () => window.removeEventListener("mc:toast", onToast);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(92vw,22rem)] flex-col gap-2"
    >
      {items.map((t) => {
        const I = Icon[t.tone];
        return (
          <div
            key={t.id}
            className="bg-night shadow-lifted pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm text-white motion-safe:animate-[rise_.25s_var(--ease-out)]"
          >
            <I
              className={cn(
                "mt-0.5 size-4 shrink-0",
                t.tone === "success"
                  ? "text-signal"
                  : t.tone === "error"
                    ? "text-[#ff9b8f]"
                    : "text-dusk-300",
              )}
              aria-hidden
            />
            <span className="flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
