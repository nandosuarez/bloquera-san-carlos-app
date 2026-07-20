import { NextRequest, NextResponse } from "next/server";
import {
  getPendingDeliveryReport,
  type PendingDeliveryStatusFilter
} from "@/lib/pending-deliveries";
import { redirectTo } from "@/lib/redirects";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return redirectTo(request, "/login");
  }

  const report = await getPendingDeliveryReport({
    customerId: request.nextUrl.searchParams.get("customerId"),
    dateFrom: request.nextUrl.searchParams.get("dateFrom"),
    dateTo: request.nextUrl.searchParams.get("dateTo"),
    productId: request.nextUrl.searchParams.get("productId"),
    status: normalizeStatus(request.nextUrl.searchParams.get("status"))
  });

  const lines = [
    "Resumen",
    "Abiertos,Cerrados,Comprado,Entregado,Saldo",
    [
      report.stats.openAccounts,
      report.stats.completedAccounts,
      report.stats.totalPurchased,
      report.stats.totalDelivered,
      report.stats.pendingQuantity
    ].map((value) => csvCell(String(value))).join(","),
    "",
    "Pendientes",
    [
      "Estado",
      "Cliente",
      "Producto",
      "Unidad",
      "Comprado",
      "Entregado",
      "Saldo",
      "Apertura",
      "Ultimo movimiento",
      "Cierre",
      "Nota"
    ].map(csvCell).join(",")
  ];

  for (const account of report.accounts) {
    lines.push(
      [
        account.status === "OPEN" ? "Abierto" : "Cerrado",
        account.customerName,
        account.productName,
        account.unitName,
        String(account.totalPurchasedQty),
        String(account.totalDeliveredQty),
        String(account.remainingQty),
        account.openedOn,
        account.lastMovementOn,
        account.closedOn ?? "",
        account.notes ?? ""
      ].map(csvCell).join(",")
    );
  }

  lines.push(
    "",
    "Movimientos",
    ["Fecha", "Tipo", "Cliente", "Producto", "Unidad", "Cantidad", "Nota"]
      .map(csvCell)
      .join(",")
  );

  for (const movement of report.movements) {
    lines.push(
      [
        movement.movementOn,
        movement.movementType === "PURCHASE" ? "Compra" : "Entrega",
        movement.customerName,
        movement.productName,
        movement.unitName,
        String(movement.quantity),
        movement.notes ?? ""
      ].map(csvCell).join(",")
    );
  }

  const csvContent = `\uFEFF${lines.join("\n")}`;
  const fileDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvContent, {
    headers: {
      "Content-Disposition": `attachment; filename=\"pendientes_entrega_${fileDate}.csv\"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function normalizeStatus(value: string | null): PendingDeliveryStatusFilter {
  if (value === "COMPLETED" || value === "ALL") return value;
  return "OPEN";
}

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
