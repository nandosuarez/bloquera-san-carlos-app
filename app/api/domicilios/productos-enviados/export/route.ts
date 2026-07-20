import { NextRequest, NextResponse } from "next/server";
import { getDeliveryProductsReport } from "@/lib/delivery-services";
import { redirectTo } from "@/lib/redirects";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return redirectTo(request, "/login");
  }

  const fromDate = request.nextUrl.searchParams.get("fromDate");
  const toDate = request.nextUrl.searchParams.get("toDate");
  const sentProductId = request.nextUrl.searchParams.get("sentProductId");

  const report = await getDeliveryProductsReport({
    fromDate,
    sentProductId,
    toDate
  });

  const lines = ["Producto,Unidad,Cantidad total,Viajes"];
  for (const item of report.items) {
    lines.push(
      `${csvCell(item.productName)},${csvCell(item.unitName)},${csvCell(String(item.totalQuantity))},${csvCell(String(item.totalTrips))}`
    );
  }

  const csvContent = `\uFEFF${lines.join("\n")}`;
  const fileDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvContent, {
    headers: {
      "Content-Disposition": `attachment; filename=\"productos_enviados_${fileDate}.csv\"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
