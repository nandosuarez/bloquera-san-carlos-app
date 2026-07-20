import { NextRequest, NextResponse } from "next/server";
import { createCustomer, OperationsError } from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=customers&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();

  try {
    await createCustomer({
      address: String(formData.get("address") ?? ""),
      name: String(formData.get("name") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      phone: String(formData.get("phone") ?? "")
    });

    return redirectToPage(request, "success=customer_saved");
  } catch (error) {
    console.error("Error creating customer", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
