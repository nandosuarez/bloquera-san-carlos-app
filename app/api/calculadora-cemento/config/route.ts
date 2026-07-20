import { NextRequest, NextResponse } from "next/server";
import {
  CementCalculatorError,
  saveCementCalculatorConfig
} from "@/lib/cement-calculator";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { getCementBrandDefinition, type CementCalculatorConfig } from "@/lib/cement-calculator-shared";

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return NextResponse.json(
      { error: "no_session", message: "Sesion expirada." },
      { status: 401 }
    );
  }

  try {
    const payload = (await request.json()) as Partial<CementCalculatorConfig>;
    const config = normalizePayload(payload);

    await saveCementCalculatorConfig(config, session.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CementCalculatorError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 }
      );
    }

    console.error("Error saving cement calculator config", error);
    return NextResponse.json(
      { error: "server_error", message: "No fue posible guardar la configuracion." },
      { status: 500 }
    );
  }
}

function normalizePayload(payload: Partial<CementCalculatorConfig>): CementCalculatorConfig {
  const brands = Array.isArray(payload.brands) ? payload.brands : [];
  const normalizedBrands: CementCalculatorConfig["brands"] = [];

  for (const brand of brands) {
    const definition = getCementBrandDefinition(String(brand?.id ?? ""));
    if (!definition) {
      continue;
    }

    const products = Array.isArray(brand.products)
      ? brand.products.map((product) => ({
          id: String(product.id ?? "").trim(),
          label: String(product.label ?? ""),
          salePriceRef:
            product.salePriceRef === null || product.salePriceRef === undefined
              ? null
              : Number(product.salePriceRef),
          unitWeightKg:
            product.unitWeightKg === null || product.unitWeightKg === undefined
              ? null
              : Number(product.unitWeightKg)
        }))
      : [];

    normalizedBrands.push({
      id: definition.id,
      ivaRate: definition.ivaRate,
      label: definition.label,
      mulaBagsQty: Number(brand.mulaBagsQty ?? definition.defaultMulaBagsQty),
      products,
      totalCoteros: Number(brand.totalCoteros ?? 0),
      totalMula: Number(brand.totalMula ?? 0)
    });
  }

  return { brands: normalizedBrands };
}
