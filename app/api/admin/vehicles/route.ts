import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireAdminRequest } from "@/lib/permissions";
import { createVehicle, updateVehicle, VehicleError } from "@/lib/vehicles";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/administracion?section=vehicles&${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");

  try {
    if (action === "update-vehicle") {
      await updateVehicle({
        label: String(formData.get("label") ?? ""),
        maxLoadKg: parseOptionalNumber(formData.get("maxLoadKg")),
        notes: String(formData.get("notes") ?? ""),
        plate: String(formData.get("plate") ?? ""),
        vehicleId: String(formData.get("vehicleId") ?? "")
      });

      await recordAuditLog({
        action: "UPDATE",
        actor: session,
        entityId: String(formData.get("vehicleId") ?? ""),
        entityType: "delivery_vehicle",
        summary: "Carro actualizado"
      });

      return redirectToPage(request, "success=vehicle_updated");
    }

    await createVehicle({
      label: String(formData.get("label") ?? ""),
      maxLoadKg: parseOptionalNumber(formData.get("maxLoadKg")),
      notes: String(formData.get("notes") ?? ""),
      plate: String(formData.get("plate") ?? "")
    });

    await recordAuditLog({
      action: "CREATE",
      actor: session,
      entityType: "delivery_vehicle",
      summary: "Carro creado"
    });

    return redirectToPage(request, "success=vehicle_saved");
  } catch (error) {
    console.error("Error creating vehicle", error);

    if (error instanceof VehicleError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
