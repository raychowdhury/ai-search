"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, Notice, inputClass } from "@/components/ui";
import type { FormState } from "@/server/actions/business";
import type { Business } from "@/lib/business/schema";

interface Props {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  countries: Array<{ code: string; name: string }>;
  initial?: Business | null;
}

export function BusinessForm({ action, countries, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors ?? {};
  const inv = (k: string) => (e[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Card>
        <CardTitle>Your business</CardTitle>
        <Field label="Business name" name="name" error={e.name} hint="Exactly as customers know it.">
          <input id="name" name="name" defaultValue={initial?.name} className={inputClass} required {...inv("name")} />
        </Field>
        <Field label="Other names customers use (optional)" name="aliases" error={e.aliases} hint="Separate with commas. Example: Riverside Dental, Dr. Lee's office">
          <input id="aliases" name="aliases" defaultValue={initial?.aliases.join(", ")} className={inputClass} {...inv("aliases")} />
        </Field>
        <Field label="Type of business" name="category" error={e.category} hint="Example: dentist, bakery, plumber, hair salon">
          <input id="category" name="category" defaultValue={initial?.category} className={inputClass} required {...inv("category")} />
        </Field>
        <Field label="Website" name="websiteUrl" error={e.websiteUrl} hint="Example: https://www.yourbusiness.com">
          <input id="websiteUrl" name="websiteUrl" type="url" inputMode="url" defaultValue={initial?.websiteUrl} className={inputClass} required {...inv("websiteUrl")} />
        </Field>
      </Card>

      <Card>
        <CardTitle>Where you are</CardTitle>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="City" name="city" error={e.city}>
            <input id="city" name="city" defaultValue={initial?.city} className={inputClass} required {...inv("city")} />
          </Field>
          <Field label="State or region" name="region" error={e.region}>
            <input id="region" name="region" defaultValue={initial?.region} className={inputClass} required {...inv("region")} />
          </Field>
          <Field label="Country" name="country" error={e.country}>
            <select id="country" name="country" defaultValue={initial?.country ?? ""} className={inputClass} required {...inv("country")}>
              <option value="" disabled>Choose a country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Time zone (optional)" name="timezone" error={e.timezone} hint="Example: America/Chicago">
            <input id="timezone" name="timezone" defaultValue={initial?.timezone ?? ""} className={inputClass} {...inv("timezone")} />
          </Field>
        </div>
        <Field label="Area you serve" name="serviceArea" error={e.serviceArea} hint="In your own words. Example: Springfield and towns within 20 miles">
          <input id="serviceArea" name="serviceArea" defaultValue={initial?.serviceArea} className={inputClass} required {...inv("serviceArea")} />
        </Field>
      </Card>

      <Card>
        <CardTitle>What you offer</CardTitle>
        <Field label="Main services" name="services" error={e.services} hint="One per line or separated by commas. Up to 15.">
          <textarea id="services" name="services" rows={4} defaultValue={initial?.services.join("\n")} className={inputClass} required {...inv("services")} />
        </Field>
      </Card>

      <Card>
        <CardTitle>What happens next</CardTitle>
        <p className="m2 m-0 text-[14px] leading-relaxed">
          We will suggest questions customers might ask an AI assistant about a business like yours. When you run a check, we ask those questions through the assistants&apos; official APIs with your city as context, save the full answers, and show you what they contain. Results vary by platform, wording, and time.
        </p>
      </Card>

      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
      <div className="sticky bottom-[52px] flex justify-end border-t border-line bg-bg/90 py-3 backdrop-blur lg:bottom-0">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "Save and continue"}</Button>
      </div>
    </form>
  );
}
