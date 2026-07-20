import { NextRequest, NextResponse } from "next/server";
import { createUser, OperationsError } from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/administracion?section=users&${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();

  try {
    await createUser({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "ADMIN"),
      username: String(formData.get("username") ?? "")
    });

    return redirectToPage(request, "success=user_saved");
  } catch (error) {
    console.error("Error creating user", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
