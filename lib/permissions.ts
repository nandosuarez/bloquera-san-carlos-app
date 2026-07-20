import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirectTo } from "@/lib/redirects";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionData
} from "@/lib/session";

export type AppRole = "SUPERADMIN" | "ADMIN" | "OPERACION" | "VENTAS";

const ROLE_GROUPS = {
  admin: ["SUPERADMIN", "ADMIN"],
  operations: ["SUPERADMIN", "ADMIN", "OPERACION"],
  sales: ["SUPERADMIN", "ADMIN", "OPERACION", "VENTAS"]
} as const;

export function canAccessRole(role: string, allowedRoles: readonly string[]) {
  return allowedRoles.includes(role.toLocaleUpperCase("es-CO"));
}

export function requirePageRole(allowedRoles: readonly string[]) {
  const session = verifySessionToken(
    cookies().get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    redirect("/login");
  }

  if (!canAccessRole(session.role, allowedRoles)) {
    redirect("/inicio?error=forbidden");
  }

  return session;
}

export function requireAdminPage() {
  return requirePageRole(ROLE_GROUPS.admin);
}

export function requireOperationsPage() {
  return requirePageRole(ROLE_GROUPS.operations);
}

export function requireSalesPage() {
  return requirePageRole(ROLE_GROUPS.sales);
}

export function requireRequestRole(
  request: NextRequest,
  allowedRoles: readonly string[]
): SessionData | NextResponse {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return redirectTo(request, "/login");
  }

  if (!canAccessRole(session.role, allowedRoles)) {
    return redirectTo(request, "/inicio?error=forbidden");
  }

  return session;
}

export function requireAdminRequest(request: NextRequest) {
  return requireRequestRole(request, ROLE_GROUPS.admin);
}

export function requireOperationsRequest(request: NextRequest) {
  return requireRequestRole(request, ROLE_GROUPS.operations);
}

export function requireSalesRequest(request: NextRequest) {
  return requireRequestRole(request, ROLE_GROUPS.sales);
}
