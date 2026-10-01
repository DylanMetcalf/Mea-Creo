"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useActionState,
  useContext,
  useId,
} from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { cn } from "./cn";

const FormStateContext = createContext<ActionState>(null);

export function useFormState() {
  return useContext(FormStateContext);
}

/**
 * A form bound to a Server Action with useActionState: shows the returned message,
 * field errors, keeps entered values after errors, and works without JavaScript.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess,
  id,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <FormStateContext.Provider value={state}>
      <form
        id={id}
        action={formAction}
        className={className}
        key={resetOnSuccess && state?.ok ? JSON.stringify(state) : undefined}
        noValidate
      >
        {state?.message && state.ok === false && (
          <FormMessage tone="error">{state.message}</FormMessage>
        )}
        {state?.ok && (state.message || successMessage) && (
          <FormMessage tone="success">{state.message ?? successMessage}</FormMessage>
        )}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        tone === "error" ? "bg-danger-100 text-danger-700" : "bg-success-100 text-success-700",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

const inputBase =
  "block w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle shadow-card focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-surface-2 aria-[invalid=true]:border-danger-700";

type FieldProps = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

function useField(name: string) {
  const state = useFormState();
  const id = useId();
  const errors = state?.fieldErrors?.[name];
  return { id, errors, value: state?.values?.[name] };
}

function FieldShell({
  id,
  label,
  hint,
  errors,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger-700" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !errors && (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {errors && (
        <p id={`${id}-error`} className="text-danger-700 text-xs">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  required,
  className,
  defaultValue,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const { id, errors, value } = useField(name);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-error` : hint ? `${id}-hint` : undefined}
        defaultValue={value ?? defaultValue}
        className={inputBase}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({
  name,
  label,
  hint,
  required,
  className,
  defaultValue,
  rows = 4,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const { id, errors, value } = useField(name);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-error` : hint ? `${id}-hint` : undefined}
        defaultValue={value ?? defaultValue}
        className={inputBase}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  required,
  className,
  options,
  defaultValue,
  placeholder,
  ...props
}: FieldProps &
  Omit<ComponentProps<"select">, "name"> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  }) {
  const { id, errors, value } = useField(name);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      errors={errors}
      required={required}
      className={className}
    >
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={errors ? true : undefined}
        defaultValue={value ?? defaultValue ?? ""}
        className={cn(inputBase, "pr-8")}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  className,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  className?: string;
}) {
  const { id, errors } = useField(name);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-invalid={errors ? true : undefined}
        className="border-border-strong accent-brand-700 mt-0.5 size-4 rounded"
      />
      <div className="text-sm">
        <label htmlFor={id} className="text-ink">
          {label}
        </label>
        {hint && <p className="text-muted text-xs">{hint}</p>}
        {errors && <p className="text-danger-700 text-xs">{errors[0]}</p>}
      </div>
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

export { inputBase };
