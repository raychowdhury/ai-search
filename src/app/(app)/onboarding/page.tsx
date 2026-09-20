import { requireUser } from "@/server/auth";
import { getDb } from "@/db/client";
import { getBusinessForUser } from "@/lib/business/repo";
import { countryOptions } from "@/lib/business/countries";
import { saveBusinessAction } from "@/server/actions/business";
import { PageTitle } from "@/components/ui";
import { BusinessForm } from "./BusinessForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const business = getBusinessForUser(getDb(), user.id);
  return (
    <>
      <PageTitle sub={business ? "Update the details we use for your checks." : "About two minutes. You can change anything later."}>
        {business ? "Your business details" : "Tell us about your business"}
      </PageTitle>
      <BusinessForm action={saveBusinessAction} countries={countryOptions()} initial={business} />
    </>
  );
}
