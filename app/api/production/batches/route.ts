import { NextRequest, NextResponse } from "next/server";
import { OperationsError, recordBlockProduction } from "@/lib/operations";
import { recordAuditLog } from "@/lib/audit";
import { requireOperationsRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/produccion-bloques?${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireOperationsRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const blockProductId = String(formData.get("blockProductId") ?? "").trim();
  const cementProductId = String(formData.get("cementProductId") ?? "").trim();
  const cementUsedQty = Number(String(formData.get("cementUsedQty") ?? "").replace(",", "."));
  const collaboratorId = String(formData.get("collaboratorId") ?? "").trim();
  const productionOn = String(formData.get("productionOn") ?? "").trim();
  const producedQty = Number(String(formData.get("producedQty") ?? "").replace(",", "."));
  const laborUnitCost = Number(
    String(formData.get("laborUnitCost") ?? "0").replace(",", ".")
  );
  const sandProductId = String(formData.get("sandProductId") ?? "").trim();
  const sandUsedQty = Number(String(formData.get("sandUsedQty") ?? "").replace(",", "."));

  if (
    !blockProductId ||
    !cementProductId ||
    !Number.isFinite(cementUsedQty) ||
    cementUsedQty <= 0 ||
    !collaboratorId ||
    !productionOn ||
    !Number.isFinite(producedQty) ||
    producedQty <= 0 ||
    !sandProductId ||
    !Number.isFinite(sandUsedQty) ||
    sandUsedQty <= 0
  ) {
    return redirectToPage(request, "error=missing_production_fields");
  }

  try {
    const result = await recordBlockProduction({
      blockProductId,
      cementProductId,
      cementUsedQty,
      collaboratorId,
      laborUnitCost: Number.isFinite(laborUnitCost) ? laborUnitCost : 0,
      notes: String(formData.get("notes") ?? ""),
      producedQty,
      productionOn,
      recordedByUserId: session.userId,
      sandProductId,
      sandUsedQty
    });

    await recordAuditLog({
      action: "CREATE",
      actor: session,
      entityId: result.batchId,
      entityType: "block_production_batch",
      summary: "Produccion de bloques registrada"
    });

    return redirectToPage(request, "success=production_saved");
  } catch (error) {
    console.error("Error saving production batch", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
