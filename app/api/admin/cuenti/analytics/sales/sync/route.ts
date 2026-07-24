import { NextRequest, NextResponse } from "next/server";
import { CuentiIntegrationError } from "@/lib/cuenti";
import { syncCuentiSalesWarehouse } from "@/lib/cuenti-analytics-sync";
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
    const result = await syncCuentiSalesWarehouse({
      initiatedByUserId: session.userId
    });
    const query = new URLSearchParams({
      backfill: result.backfillComplete ? "1" : "0",
      complete: result.windowComplete ? "1" : "0",
      created: String(result.recordsCreated),
      details: String(result.details),
      from: result.dateFrom,
      nextPage: String(result.nextPage),
      pages: String(result.pages),
      skipped: String(result.recordsSkipped),
      sourceRows: String(result.sourceRows),
      success: "cuenti_sales_synced",
      to: result.dateTo,
      updated: String(result.recordsUpdated)
    });

    return redirectToPage(request, query.toString());
  } catch (error) {
    console.error("Error syncing Cuenti analytics sales", error);

    if (error instanceof CuentiIntegrationError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=cuenti_sales_sync_failed");
  }
}
