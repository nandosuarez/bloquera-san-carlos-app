import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";
import {
  CuentiIntegrationError,
  testCuentiConnection
} from "@/lib/cuenti";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=cuenti&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await testCuentiConnection();
    const params = new URLSearchParams({
      success: "cuenti_connected"
    });

    if (result.branchCount !== null) {
      params.set("branches", String(result.branchCount));
    }

    return redirectToPage(request, params.toString());
  } catch (error) {
    console.error("Error testing Cuenti connection", error);

    if (error instanceof CuentiIntegrationError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
