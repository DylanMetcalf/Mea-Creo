import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ActionForm,
  CheckboxField,
  RadioField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { getTestimonialRequest } from "@/modules/testimonials/service";
import { submitTestimonialAction } from "./actions";

export const metadata: Metadata = {
  title: "Share your experience",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function TestimonialPage({ params }: PageProps<"/testimonial/[token]">) {
  const { token } = await params;
  const row = await getTestimonialRequest(await getDb(), token);
  if (!row) notFound();
  if (row.status !== "requested")
    return (
      <Card className="mx-auto max-w-xl">
        <CardBody>
          <h1 className="font-display text-[1.8rem]">Thank you</h1>
          <p className="text-muted mt-2">
            We&apos;ve received your words. You can close this page.
          </p>
        </CardBody>
      </Card>
    );
  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="p-6 sm:p-8">
        <p className="label-mono text-brand-600">One minute</p>
        <h1 className="font-display mt-2 text-[1.9rem] leading-tight">
          How has working with Mea Creo been?
        </h1>
        <p className="text-muted mt-3">
          A sentence or two in your own words is perfect. You choose how you&apos;re credited, and
          nothing is published without your permission.
        </p>
        <ActionForm action={submitTestimonialAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <TextArea name="quote" label="Your words" rows={4} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField name="name" label="Your name" />
            <TextField name="role" label="Your role" />
            <TextField name="company" label="Company (optional)" />
            <TextField name="industry" label="Industry" />
          </div>
          <RadioField
            name="attribution"
            label="How should we credit you?"
            defaultValue="named"
            options={[
              { value: "named", label: "Name, role and company" },
              { value: "anonymous", label: "Role and industry only", hint: "No name or company" },
            ]}
          />
          <CheckboxField
            name="consent"
            label="Mea Creo may publish these words on its website and marketing, credited as I chose."
            hint="You can ask us to remove it at any time: dylan@meacreo.co.za"
          />
          <SubmitButton>Send</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
