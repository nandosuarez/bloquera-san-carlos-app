import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export function requireSession() {
  const session = verifySessionToken(
    cookies().get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    redirect("/login");
  }

  return session;
}
