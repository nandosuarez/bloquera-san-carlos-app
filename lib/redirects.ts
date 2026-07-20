import { NextResponse } from "next/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function createPublicUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host")) ?? requestUrl.host;
  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");

  return new URL(path, `${protocol}://${host}`);
}

export function redirectTo(request: Request, path: string, status = 303) {
  return NextResponse.redirect(createPublicUrl(request, path), status);
}
