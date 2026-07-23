import { NextRequest, NextResponse } from "next/server";
import { CuentiIntegrationError } from "@/lib/cuenti";
import { syncCuentiProductStocks } from "@/lib/cuenti-stock-sync";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=cuenti&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await syncCuentiProductStocks();
    const query = new URLSearchParams({
      branch: result.branchId ?? "",
      checked: String(result.checked),
      failed: String(result.failed),
      skipped: String(result.skipped),
      success: "cuenti_stock_synced",
      tried: result.branchCandidates.join(","),
      updated: String(result.updated)
    });

    return redirectToPage(request, query.toString());
  } catch (error) {
    console.error("Error syncing Cuenti product stock", error);

    if (error instanceof CuentiIntegrationError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
