import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { signupAction } from "@/server/actions/auth";
import { AuthForm } from "../AuthForm";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="signup" action={signupAction} />;
}
