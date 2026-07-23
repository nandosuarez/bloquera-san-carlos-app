import { upsertCuentiCustomer } from "@/lib/cuenti-customer-sync";
import {
  getCuentiSaleDetail,
  type CuentiSaleSource
} from "@/lib/cuenti";
import { requireSalesRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = requireSalesRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const saleRef = String(formData.get("saleRef") ?? "").trim();
  const saleSource = normalizeSaleSource(
    String(formData.get("saleSource") ?? "")
  );

  if (!saleRef) {
    return redirectTo(request, "/domicilios?section=ventas&error=server_error");
  }

  try {
    const sale = await getCuentiSaleDetail(saleRef, saleSource);

    if (!sale) {
      return redirectTo(
        request,
        "/domicilios?section=ventas&error=server_error"
      );
    }

    if (sale.customerName) {
      await upsertCuentiCustomer({
        address: sale.customerAddress,
        cuentiCustomerId: sale.cuentiCustomerId,
        email: null,
        identification: sale.customerIdentification,
        name: sale.customerName,
        notes: `Cliente cargado desde ${formatSaleSource(saleSource)} ${sale.documentNumber ?? saleRef}.`,
        phone: sale.customerPhone
      });
    }

    const params = new URLSearchParams();
    params.set("section", "programar");
    params.set("saleRef", saleRef);
    params.set("saleSource", saleSource);

    return redirectTo(request, `/domicilios?${params.toString()}`);
  } catch (error) {
    console.error("Error loading Cuenti sale into delivery", error);

    return redirectTo(
      request,
      "/domicilios?section=ventas&error=server_error"
    );
  }
}

function normalizeSaleSource(value: string): CuentiSaleSource {
  return value === "order" ? "order" : "invoice";
}

function formatSaleSource(source: CuentiSaleSource) {
  return source === "order" ? "pedido" : "factura";
}
