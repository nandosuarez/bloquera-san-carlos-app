import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  OperationsError,
  type ProductCategory,
  type RawMaterialType,
  updateProduct
} from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=products&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");

  try {
    if (action === "update-product") {
      await updateProduct({
        blockLaborUnitCost: parseOptionalNumber(formData.get("blockLaborUnitCost")),
        category: normalizeCategory(String(formData.get("category") ?? "")),
        currentStockQty: parseOptionalNumber(formData.get("currentStockQty")),
        dimensionLabel: String(formData.get("dimensionLabel") ?? ""),
        minStockQty: parseOptionalNumber(formData.get("minStockQty")),
        notes: String(formData.get("notes") ?? ""),
        productId: String(formData.get("productId") ?? ""),
        productLineId: String(formData.get("productLineId") ?? ""),
        rawMaterialType: normalizeRawMaterialType(String(formData.get("rawMaterialType") ?? "")),
        salePrice: parseOptionalNumber(formData.get("salePrice")),
        sku: String(formData.get("sku") ?? ""),
        standardCost: parseOptionalNumber(formData.get("standardCost")),
        unitName: String(formData.get("unitName") ?? ""),
        weightKg: parseOptionalNumber(formData.get("weightKg"))
      });

      return redirectToPage(request, "success=product_updated");
    }

    await createProduct({
      blockLaborUnitCost: parseOptionalNumber(formData.get("blockLaborUnitCost")),
      category: normalizeCategory(String(formData.get("category") ?? "")),
      currentStockQty: parseOptionalNumber(formData.get("currentStockQty")),
      dimensionLabel: String(formData.get("dimensionLabel") ?? ""),
      minStockQty: parseOptionalNumber(formData.get("minStockQty")),
      name: String(formData.get("name") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      productLineId: String(formData.get("productLineId") ?? ""),
      rawMaterialType: normalizeRawMaterialType(String(formData.get("rawMaterialType") ?? "")),
      salePrice: parseOptionalNumber(formData.get("salePrice")),
      sku: String(formData.get("sku") ?? ""),
      standardCost: parseOptionalNumber(formData.get("standardCost")),
      unitName: String(formData.get("unitName") ?? ""),
      weightKg: parseOptionalNumber(formData.get("weightKg"))
    });

    return redirectToPage(request, "success=product_saved");
  } catch (error) {
    console.error("Error saving product", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}

function normalizeCategory(value: string): ProductCategory {
  if (value === "RAW_MATERIAL" || value === "BLOCK") {
    return value;
  }

  return "GENERAL";
}

function normalizeRawMaterialType(value: string): RawMaterialType | null {
  if (value === "CEMENT" || value === "SAND") return value;
  return null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
