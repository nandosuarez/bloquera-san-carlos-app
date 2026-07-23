import { getCuentiSalesDiagnostics } from "@/lib/cuenti";
import { requireAdminRequest } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const dateFrom = request.nextUrl.searchParams.get("dateFrom")?.trim();
  const dateTo = request.nextUrl.searchParams.get("dateTo")?.trim();

  if (
    !dateFrom ||
    !dateTo ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
  ) {
    return NextResponse.json(
      { error: "invalid_date_range" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      diagnostics: await getCuentiSalesDiagnostics({ dateFrom, dateTo })
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "diagnostics_failed"
      },
      { status: 500 }
    );
  }
}
