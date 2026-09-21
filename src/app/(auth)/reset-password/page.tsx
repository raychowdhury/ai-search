import { resetPasswordAction } from "@/server/actions/auth";
import { SimpleAuthForm } from "../SimpleAuthForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <SimpleAuthForm
      title="Choose a new password"
      intro="After you save it, you will be signed in here and signed out everywhere else."
      action={resetPasswordAction}
      submitLabel="Save new password"
      hidden={{ token: token ?? "" }}
      fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." }]}
    />
  );
}
