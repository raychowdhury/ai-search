import { forgotPasswordAction } from "@/server/actions/auth";
import { SimpleAuthForm } from "../SimpleAuthForm";

export default function ForgotPasswordPage() {
  return (
    <SimpleAuthForm
      title="Reset your password"
      intro="Enter your email and we will send a link to choose a new password. The link works for one hour."
      action={forgotPasswordAction}
      submitLabel="Send reset link"
      successMessage="If an account exists for that email, a reset link is on its way. Check your inbox."
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
    />
  );
}
