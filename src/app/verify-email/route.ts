import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { consumeToken } from "@/lib/auth/tokens";
import { markEmailVerified } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

/** Link target from the verification email. Marks the address verified and lands on Settings. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const db = getDb();
  const userId = consumeToken(db, token, "verify");
  const to = new URL(userId ? "/settings?verified=1" : "/settings?error=verify_invalid", req.url);
  if (userId) markEmailVerified(db, userId);
  return NextResponse.redirect(to);
}
