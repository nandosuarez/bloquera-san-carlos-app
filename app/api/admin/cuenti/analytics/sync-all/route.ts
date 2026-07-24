import { NextRequest, NextResponse } from "next/server";
import {
  CuentiWarehouseSyncError,
  syncCuentiWarehouse
} from "@/lib/cuenti-sync-coordinator";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await syncCuentiWarehouse({
      includeInventory: true,
      initiatedByUserId: session.userId
    });

    return redirectTo(
      request,
      `/administracion?section=cuenti&success=cuenti_warehouse_synced&sales=${result.sales.recordsCreated + result.sales.recordsUpdated}&payments=${result.payments.recordsCreated + result.payments.recordsUpdated}&stock=${result.inventory?.snapshotCount ?? 0}`
    );
  } catch (error) {
    console.error("Error syncing complete Cuenti warehouse", error);

    const code =
      error instanceof CuentiWarehouseSyncError
        ? `cuenti_warehouse_${error.stage}_failed`
        : "cuenti_warehouse_sync_failed";

    return redirectTo(request, `/administracion?section=cuenti&error=${code}`);
  }
}
