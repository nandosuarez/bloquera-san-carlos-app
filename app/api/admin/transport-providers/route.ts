import { NextRequest, NextResponse } from "next/server";
import {
  createTransportProvider,
  TransportProviderError
} from "@/lib/transport-providers";
import { requireAdminRequest } from "@/lib/permissions";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/administracion?section=transport-providers&${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();

  try {
    await createTransportProvider({
      name: String(formData.get("name") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      phone: String(formData.get("phone") ?? "")
    });

    return redirectToPage(request, "success=transport_provider_saved");
  } catch (error) {
    console.error("Error creating transport provider", error);

    if (error instanceof TransportProviderError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
