import { NextRequest, NextResponse } from "next/server";
import { CuentiIntegrationError } from "@/lib/cuenti";
import { syncCuentiPurchasesByRefs } from "@/lib/cuenti-financial-sync";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const refs = String(formData.get("refs") ?? "")
    .split(/[\s,;]+/)
    .map((ref) => ref.trim())
    .filter(Boolean);

  try {
    const result = await syncCuentiPurchasesByRefs({
      initiatedByUserId: session.userId,
      refs
    });

    return redirectTo(
      request,
      `/administracion?section=cuenti&success=cuenti_purchases_synced&created=${result.recordsCreated}&updated=${result.recordsUpdated}&skipped=${result.recordsSkipped}`
    );
  } catch (error) {
    console.error("Error syncing Cuenti purchases", error);

    const code =
      error instanceof CuentiIntegrationError
        ? error.code
        : "cuenti_purchases_sync_failed";

    return redirectTo(request, `/administracion?section=cuenti&error=${code}`);
  }
}
