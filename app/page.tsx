import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const session = verifySessionToken(
    cookies().get(SESSION_COOKIE_NAME)?.value ?? null
  );

  redirect(session ? "/inicio" : "/login");
}
