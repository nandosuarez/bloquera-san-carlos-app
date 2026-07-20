"use client";

import { useMemo, useState } from "react";
import type {
  CementBrandId,
  CementCalculatorBrandConfig,
  CementCalculatorConfig
} from "@/lib/cement-calculator-shared";
import {
  CEMENT_REFERENCE_BAGS_PER_MULA,
  CEMENT_REFERENCE_BAG_WEIGHT_KG
} from "@/lib/cement-calculator-shared";

type ProductRowState = {
  id: string;
  label: string;
  purchaseCostIva: string;
  quantity: string;
  salePriceRef: string;
  unitWeightKg: string;
};

type BrandState = {
  id: CementBrandId;
  ivaRate: number;
  label: string;
  mulaBagsQty: string;
  products: ProductRowState[];
  totalCoteros: string;
  totalMula: string;
};

type CementCalculatorProps = {
  initialConfig: CementCalculatorConfig;
};

export function CementCalculator({ initialConfig }: CementCalculatorProps) {
  const [activeBrandId, setActiveBrandId] = useState<CementBrandId>(
    initialConfig.brands[0]?.id ?? "argos"
  );
  const [brands, setBrands] = useState<BrandState[]>(() =>
    initialConfig.brands.map((brand) => toBrandState(brand))
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  const activeBrand = brands.find((brand) => brand.id === activeBrandId) ?? brands[0];

  const totalsByWeight = useMemo(() => {
    return activeBrand.products.reduce(
      (accumulator, product) => {
        const quantity = normalizeNumber(product.quantity);
        const unitWeightKg = normalizeUnitWeight(product.unitWeightKg);
        const totalKg = quantity * unitWeightKg;

        return {
          totalEquivalentBags:
            accumulator.totalEquivalentBags + totalKg / CEMENT_REFERENCE_BAG_WEIGHT_KG,
          totalKg: accumulator.totalKg + totalKg,
          totalQuantity: accumulator.totalQuantity + quantity
        };
      },
      { totalEquivalentBags: 0, totalKg: 0, totalQuantity: 0 }
    );
  }, [activeBrand.products]);

  const totalMula = normalizeNumber(activeBrand.totalMula);
  const totalCoteros = normalizeNumber(activeBrand.totalCoteros);
  const mulaBagsQty = normalizePositiveOrDefault(
    activeBrand.mulaBagsQty,
    CEMENT_REFERENCE_BAGS_PER_MULA
  );
  const mulaPerEquivalentBag = totalMula / mulaBagsQty;
  const coteroPerEquivalentBag = totalCoteros / mulaBagsQty;

  const calculatedRows = useMemo(() => {
    return activeBrand.products.map((product) => {
      const quantity = normalizeNumber(product.quantity);
      const purchaseCostIva = parseCurrencyNumber(product.purchaseCostIva);
      const salePriceRef = parseOptionalCurrencyNumber(product.salePriceRef);
      const unitWeightKg = normalizeUnitWeight(product.unitWeightKg);
      const equivalentBags =
        quantity > 0 ? (quantity * unitWeightKg) / CEMENT_REFERENCE_BAG_WEIGHT_KG : 0;
      const mulaCost = equivalentBags * mulaPerEquivalentBag;
      const coteroCost = equivalentBags * coteroPerEquivalentBag;
      const totalCostIva = purchaseCostIva + mulaCost + coteroCost;
      const unitCostIva = quantity > 0 ? totalCostIva / quantity : 0;
      const unitCostNoIva = quantity > 0 ? unitCostIva / (1 + activeBrand.ivaRate) : 0;
      const marginUnit = salePriceRef !== null ? salePriceRef - unitCostIva : null;
      const marginTotal = marginUnit !== null ? marginUnit * quantity : null;

      return {
        coteroCost,
        equivalentBags,
        id: product.id,
        label: product.label,
        marginTotal,
        marginUnit,
        mulaCost,
        purchaseCostIva,
        quantity,
        salePriceRef,
        totalCostIva,
        unitWeightKg,
        unitCostIva,
        unitCostNoIva
      };
    });
  }, [activeBrand, coteroPerEquivalentBag, mulaPerEquivalentBag]);

  const totals = useMemo(() => {
    return calculatedRows.reduce(
      (accumulator, row) => ({
        equivalentBags: accumulator.equivalentBags + row.equivalentBags,
        purchaseCostIva: accumulator.purchaseCostIva + row.purchaseCostIva,
        quantity: accumulator.quantity + row.quantity,
        totalCostIva: accumulator.totalCostIva + row.totalCostIva
      }),
      { equivalentBags: 0, purchaseCostIva: 0, quantity: 0, totalCostIva: 0 }
    );
  }, [calculatedRows]);

  function updateBrandField(
    brandId: CementBrandId,
    field: "totalMula" | "totalCoteros" | "mulaBagsQty",
    value: string
  ) {
    setSaveStatus("idle");
    setBrands((currentBrands) =>
      currentBrands.map((brand) =>
        brand.id === brandId ? { ...brand, [field]: value } : brand
      )
    );
  }

  function updateProductField(
    brandId: CementBrandId,
    productId: string,
    field: "quantity" | "purchaseCostIva" | "salePriceRef" | "unitWeightKg",
    value: string
  ) {
    setSaveStatus("idle");
    setBrands((currentBrands) =>
      currentBrands.map((brand) =>
        brand.id === brandId
          ? {
              ...brand,
              products: brand.products.map((product) =>
                product.id === productId ? { ...product, [field]: value } : product
              )
            }
          : brand
      )
    );
  }

  async function saveConfig() {
    setSaveStatus("saving");
    setSaveMessage("Guardando...");

    try {
      const payload: CementCalculatorConfig = {
        brands: brands.map((brand) => ({
          id: brand.id,
          ivaRate: brand.ivaRate,
          label: brand.label,
          mulaBagsQty: normalizePositiveOrDefault(
            brand.mulaBagsQty,
            CEMENT_REFERENCE_BAGS_PER_MULA
          ),
          products: brand.products.map((product) => ({
            id: product.id,
            label: product.label,
            salePriceRef: parseOptionalCurrencyNumber(product.salePriceRef),
            unitWeightKg: parseOptionalNumber(product.unitWeightKg)
          })),
          totalCoteros: normalizeNumber(brand.totalCoteros),
          totalMula: normalizeNumber(brand.totalMula)
        }))
      };

      const response = await fetch("/api/calculadora-cemento/config", {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (response.status === 401) {
        throw new Error("Sesion expirada. Inicia sesion nuevamente y vuelve a guardar.");
      }

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || "No fue posible guardar la configuracion.");
      }

      setSaveStatus("success");
      setSaveMessage("Configuracion guardada.");
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la configuracion."
      );
    }
  }

  return (
    <div className="stack-form">
      <div className="module-subnav">
        {brands.map((brand) => (
          <button
            className={`module-subnav-link ${
              activeBrand.id === brand.id ? "module-subnav-link-active" : ""
            }`}
            key={brand.id}
            onClick={() => setActiveBrandId(brand.id)}
            type="button"
          >
            {brand.label}
          </button>
        ))}
      </div>

      <div className="split-fields three-fields">
        <label className="field">
          <span>Bolsas en mula (42.5 kg)</span>
          <input
            className="table-input"
            min="1"
            onChange={(event) =>
              updateBrandField(activeBrand.id, "mulaBagsQty", event.target.value)
            }
            step="1"
            type="number"
            value={activeBrand.mulaBagsQty}
          />
        </label>

        <label className="field">
          <span>Total mula</span>
          <input
            className="table-input"
            min="0"
            onChange={(event) =>
              updateBrandField(activeBrand.id, "totalMula", event.target.value)
            }
            step="0.01"
            type="number"
            value={activeBrand.totalMula}
          />
        </label>

        <label className="field">
          <span>Total coteros</span>
          <input
            className="table-input"
            min="0"
            onChange={(event) =>
              updateBrandField(activeBrand.id, "totalCoteros", event.target.value)
            }
            step="0.01"
            type="number"
            value={activeBrand.totalCoteros}
          />
        </label>
      </div>

      <div className="stats-grid stats-grid-compact">
        <article className="stat-card">
          <span>Total cantidad</span>
          <strong>{formatQuantity(totalsByWeight.totalQuantity)}</strong>
        </article>
        <article className="stat-card">
          <span>Total kg</span>
          <strong>{formatQuantity(totalsByWeight.totalKg)}</strong>
        </article>
        <article className="stat-card">
          <span>Bolsas eq (42.5 kg)</span>
          <strong>{formatQuantity(totalsByWeight.totalEquivalentBags)}</strong>
        </article>
        <article className="stat-card">
          <span>Bolsas base mula</span>
          <strong>{formatQuantity(mulaBagsQty)}</strong>
        </article>
        <article className="stat-card">
          <span>Mula por bolsa eq</span>
          <strong>{formatMoney(mulaPerEquivalentBag)}</strong>
        </article>
        <article className="stat-card">
          <span>Cotero por bolsa eq</span>
          <strong>{formatMoney(coteroPerEquivalentBag)}</strong>
        </article>
        <article className="stat-card">
          <span>IVA</span>
          <strong>{formatPercent(activeBrand.ivaRate)}</strong>
        </article>
      </div>

      <div className="table-wrap cement-calculator-table">
        <table className="data-table">
          <colgroup>
            <col className="cement-col-product" />
            <col className="cement-col-number" />
            <col className="cement-col-number" />
            <col className="cement-col-small" />
            <col className="cement-col-money" />
            <col className="cement-col-money" />
            <col className="cement-col-input-money" />
            <col className="cement-col-money-wide" />
            <col className="cement-col-money-wide" />
            <col className="cement-col-money-wide" />
            <col className="cement-col-input-money" />
            <col className="cement-col-money-wide" />
            <col className="cement-col-money-wide" />
          </colgroup>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Peso kg / unid</th>
              <th>Bolsas eq (42.5)</th>
              <th>Mula</th>
              <th>Cotero</th>
              <th>Costo compra (IVA)</th>
              <th>Total compra (IVA)</th>
              <th>Costo unitario (IVA)</th>
              <th>Costo unitario sin IVA</th>
              <th>Precio referencia</th>
              <th>Margen unidad</th>
              <th>Margen total</th>
            </tr>
          </thead>
          <tbody>
            {calculatedRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Producto">{row.label}</td>
                <td data-label="Cantidad">
                  <input
                    className="table-input"
                    min="0"
                    onChange={(event) =>
                      updateProductField(activeBrand.id, row.id, "quantity", event.target.value)
                    }
                    step="0.01"
                    type="number"
                    value={
                      activeBrand.products.find((product) => product.id === row.id)?.quantity ?? ""
                    }
                  />
                </td>
                <td data-label="Peso kg / unid">
                  <input
                    className="table-input"
                    min="0"
                    onChange={(event) =>
                      updateProductField(
                        activeBrand.id,
                        row.id,
                        "unitWeightKg",
                        event.target.value
                      )
                    }
                    step="0.01"
                    type="number"
                    value={
                      activeBrand.products.find((product) => product.id === row.id)
                        ?.unitWeightKg ?? ""
                    }
                  />
                </td>
                <td data-label="Bolsas eq (42.5)">{formatQuantity(row.equivalentBags)}</td>
                <td data-label="Mula">{formatMoney(row.mulaCost)}</td>
                <td data-label="Cotero">{formatMoney(row.coteroCost)}</td>
                <td data-label="Costo compra (IVA)">
                  <div className="currency-input-shell">
                    <span>$</span>
                    <input
                      className="table-input money-table-input"
                      onChange={(event) =>
                        updateProductField(
                          activeBrand.id,
                          row.id,
                          "purchaseCostIva",
                          sanitizeCurrencyInput(event.target.value)
                        )
                      }
                      inputMode="decimal"
                      placeholder="0"
                      type="text"
                      value={formatCurrencyEditValue(
                        activeBrand.products.find((product) => product.id === row.id)
                          ?.purchaseCostIva ?? ""
                      )}
                    />
                  </div>
                </td>
                <td data-label="Total compra (IVA)">{formatMoneyWithCents(row.totalCostIva)}</td>
                <td data-label="Costo unitario (IVA)">{formatMoneyWithCents(row.unitCostIva)}</td>
                <td data-label="Costo unitario sin IVA">{formatMoneyWithCents(row.unitCostNoIva)}</td>
                <td data-label="Precio referencia">
                  <div className="currency-input-shell">
                    <span>$</span>
                    <input
                      className="table-input money-table-input"
                      onChange={(event) =>
                        updateProductField(
                          activeBrand.id,
                          row.id,
                          "salePriceRef",
                          sanitizeCurrencyInput(event.target.value)
                        )
                      }
                      inputMode="decimal"
                      placeholder="0"
                      type="text"
                      value={formatCurrencyEditValue(
                        activeBrand.products.find((product) => product.id === row.id)
                          ?.salePriceRef ?? ""
                      )}
                    />
                  </div>
                </td>
                <td data-label="Margen unidad">
                  {row.marginUnit !== null ? formatMoneyWithCents(row.marginUnit) : "-"}
                </td>
                <td data-label="Margen total">
                  {row.marginTotal !== null ? formatMoneyWithCents(row.marginTotal) : "-"}
                </td>
              </tr>
            ))}
            <tr>
              <td data-label="Producto">
                <strong>Totales</strong>
              </td>
              <td data-label="Cantidad">
                <strong>{formatQuantity(totals.quantity)}</strong>
              </td>
              <td data-label="Peso kg / unid">
                <strong>-</strong>
              </td>
              <td data-label="Bolsas eq (42.5)">
                <strong>{formatQuantity(totals.equivalentBags)}</strong>
              </td>
              <td data-label="Mula">
                <strong>{formatMoney(totalMula)}</strong>
              </td>
              <td data-label="Cotero">
                <strong>{formatMoney(totalCoteros)}</strong>
              </td>
              <td data-label="Costo compra (IVA)">
                <strong>{formatMoneyWithCents(totals.purchaseCostIva)}</strong>
              </td>
              <td data-label="Total compra (IVA)">
                <strong>{formatMoneyWithCents(totals.totalCostIva)}</strong>
              </td>
              <td data-label="Costo unitario (IVA)">-</td>
              <td data-label="Costo unitario sin IVA">-</td>
              <td data-label="Precio referencia">-</td>
              <td data-label="Margen unidad">-</td>
              <td data-label="Margen total">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="split-fields">
        <button
          className="primary-button"
          disabled={saveStatus === "saving"}
          onClick={saveConfig}
          type="button"
        >
          {saveStatus === "saving" ? "Guardando..." : "Guardar configuracion"}
        </button>
        <div className="field">
          <span>Estado</span>
          <input readOnly type="text" value={saveMessage || "Sin cambios guardados"} />
        </div>
      </div>
    </div>
  );
}

function toBrandState(brand: CementCalculatorBrandConfig): BrandState {
  return {
    id: brand.id,
    ivaRate: brand.ivaRate,
    label: brand.label,
    mulaBagsQty: String(brand.mulaBagsQty),
    products: brand.products.map((product) => ({
      id: product.id,
      label: product.label,
      purchaseCostIva: "",
      quantity: "",
      salePriceRef: toCurrencyStorageValue(product.salePriceRef),
      unitWeightKg:
        product.unitWeightKg === null || product.unitWeightKg === undefined
          ? ""
          : String(product.unitWeightKg)
    })),
    totalCoteros: String(brand.totalCoteros),
    totalMula: String(brand.totalMula)
  };
}

function normalizeNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseOptionalNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeUnitWeight(value: string) {
  const parsed = parseOptionalNumber(value);
  if (parsed === null || parsed <= 0) {
    return CEMENT_REFERENCE_BAG_WEIGHT_KG;
  }
  return parsed;
}

function normalizePositiveOrDefault(value: string, fallback: number) {
  const parsed = normalizeNumber(value);
  return parsed > 0 ? parsed : fallback;
}

function sanitizeCurrencyInput(value: string) {
  const normalized = value.replace(/[^\d.,]/g, "");
  if (!normalized) return "";

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex === -1) {
    return normalized.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  }

  const decimalPart = normalized.slice(decimalIndex + 1).replace(/\D/g, "");
  const integerPart = normalized.slice(0, decimalIndex).replace(/\D/g, "");
  const cleanInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";

  if (decimalPart.length === 0 && decimalIndex === normalized.length - 1) {
    return `${cleanInteger}.`;
  }

  const hasExplicitDecimals =
    decimalPart.length > 0 &&
    decimalPart.length <= 2 &&
    !hasOnlyThousandsSeparators(normalized);

  if (!hasExplicitDecimals) {
    return normalized.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  }

  return `${cleanInteger}.${decimalPart.slice(0, 2)}`;
}

function parseCurrencyNumber(value: string) {
  const normalized = sanitizeCurrencyInput(value);
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseOptionalCurrencyNumber(value: string) {
  const normalized = sanitizeCurrencyInput(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function formatCurrencyEditValue(value: string) {
  if (!value) return "";

  const hasDecimal = value.includes(".");
  const [integerPart, decimalPart = ""] = value.split(".");
  const integerDigits = integerPart.replace(/\D/g, "");
  const formattedInteger = formatIntegerDigits(integerDigits);

  if (!hasDecimal) {
    return formattedInteger;
  }

  return `${formattedInteger},${decimalPart.replace(/\D/g, "").slice(0, 2)}`;
}

function formatIntegerDigits(value: string) {
  const normalized = value.replace(/^0+(?=\d)/, "") || "0";
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function toCurrencyStorageValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "";
  }

  return String(Math.round(value * 100) / 100);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatMoneyWithCents(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function hasOnlyThousandsSeparators(value: string) {
  const parts = value.split(/[.,]/);
  if (parts.length <= 1) return false;

  return parts.slice(1).every((part) => /^\d{3}$/.test(part));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    style: "percent"
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}
