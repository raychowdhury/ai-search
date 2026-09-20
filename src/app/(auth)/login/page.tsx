import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { loginAction } from "@/server/actions/auth";
import { AuthForm } from "../AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  return <AuthForm mode="login" action={loginAction} next={next} />;
}
