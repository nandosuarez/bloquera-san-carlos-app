import { NextRequest, NextResponse } from "next/server";
import {
  CustomerImportError,
  importCustomersFromCsv
} from "@/lib/customer-import";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToCustomers(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=customers&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const file = formData.get("customersFile");

  if (!file || typeof file === "string" || typeof file.text !== "function") {
    return redirectToCustomers(request, "error=missing_customer_import_file");
  }

  try {
    const result = await importCustomersFromCsv(await file.text());
    const query = new URLSearchParams({
      created: String(result.created),
      skipped: String(result.skipped),
      success: "customers_imported",
      updated: String(result.updated)
    });

    return redirectToCustomers(request, query.toString());
  } catch (error) {
    console.error("Error importing customers", error);

    if (error instanceof CustomerImportError) {
      return redirectToCustomers(request, `error=${error.code}`);
    }

    return redirectToCustomers(request, "error=server_error");
  }
}
