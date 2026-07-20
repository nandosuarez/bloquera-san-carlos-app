import { NextRequest, NextResponse } from "next/server";
import { createCollaborator, OperationsError } from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=collaborators&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();

  try {
    await createCollaborator({
      dailyRate: parseOptionalNumber(formData.get("dailyRate")),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      roleTitle: String(formData.get("roleTitle") ?? "")
    });

    return redirectToPage(request, "success=collaborator_saved");
  } catch (error) {
    console.error("Error creating collaborator", error);

    if (error instanceof OperationsError) {
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
