import { redirectTo } from "@/lib/redirects";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const response = redirectTo(request, "/login?success=signed_out");

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0
  });

  return response;
}
