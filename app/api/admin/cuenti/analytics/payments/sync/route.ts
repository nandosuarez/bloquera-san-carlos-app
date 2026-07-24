import { NextRequest, NextResponse } from "next/server";
import {
  CuentiIntegrationError
} from "@/lib/cuenti";
import { syncCuentiPaymentsWarehouse } from "@/lib/cuenti-financial-sync";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await syncCuentiPaymentsWarehouse({
      initiatedByUserId: session.userId
    });

    return redirectTo(
      request,
      `/administracion?section=cuenti&success=cuenti_payments_synced&created=${result.recordsCreated}&updated=${result.recordsUpdated}&skipped=${result.recordsSkipped}`
    );
  } catch (error) {
    console.error("Error syncing Cuenti payments", error);

    const code =
      error instanceof CuentiIntegrationError
        ? error.code
        : "cuenti_payments_sync_failed";

    return redirectTo(request, `/administracion?section=cuenti&error=${code}`);
  }
}
