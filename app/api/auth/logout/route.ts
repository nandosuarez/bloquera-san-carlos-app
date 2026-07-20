import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/login?success=signed_out", request.url),
    303
  );

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0
  });

  return response;
}
