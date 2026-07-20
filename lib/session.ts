import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "bloquera_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionData = {
  email: string;
  expiresAt: number;
  name: string;
  role: string;
  userId: string;
};

type SessionInput = Omit<SessionData, "expiresAt">;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable.");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(input: SessionInput) {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    })
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string | null) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  const providedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (providedSignature.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, expectedSignatureBuffer)) {
    return null;
  }

  const session = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as SessionData;

  if (session.expiresAt <= Date.now()) {
    return null;
  }

  return session;
}

export function getSessionCookieOptions() {
  const secureCookie =
    process.env.SESSION_SECURE === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.SESSION_SECURE !== "false");

  return {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: secureCookie
  };
}
