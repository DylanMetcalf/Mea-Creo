"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import {
  acceptInviteAction,
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
} from "./actions";

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <TextField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
      />
      <TextField
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
      />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}

export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction} className="space-y-4">
      <TextField name="email" type="email" label="Email" autoComplete="email" required />
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </ActionForm>
  );
}

export function NewPasswordForm({
  token,
  mode,
  email,
}: {
  token: string;
  mode: "reset" | "invite";
  email?: string;
}) {
  return (
    <ActionForm
      action={mode === "reset" ? resetPasswordAction : acceptInviteAction}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      {mode === "invite" && (
        <>
          {email && <TextField name="emailDisplay" label="Email" value={email} readOnly disabled />}
          <TextField name="name" label="Your name" autoComplete="name" required />
        </>
      )}
      <TextField
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 10 characters."
        required
      />
      <TextField
        name="confirm"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
      />
      <SubmitButton className="w-full">
        {mode === "reset" ? "Set new password" : "Create my account"}
      </SubmitButton>
    </ActionForm>
  );
}
