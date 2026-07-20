import { getDb } from "@/lib/db";
import {
  CEMENT_REFERENCE_BAGS_PER_MULA,
  CEMENT_CALCULATOR_DEFINITIONS,
  getCementBrandDefinition,
  type CementBrandId,
  type CementCalculatorConfig
} from "@/lib/cement-calculator-shared";

type BrandConfigRow = {
  brand_key: CementBrandId;
  mula_bags_qty: string | null;
  total_coteros: string;
  total_mula: string;
};

type ProductConfigRow = {
  brand_key: CementBrandId;
  product_key: string;
  sale_price_ref: string | null;
  unit_weight_kg: string | null;
};

export class CementCalculatorError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getCementCalculatorConfig(): Promise<CementCalculatorConfig> {
  const [brandResult, productResult] = await Promise.all([
    getDb().query<BrandConfigRow>(
      `
        SELECT brand_key, total_mula, total_coteros, mula_bags_qty
        FROM cement_calculator_brand_config
      `
    ),
    getDb().query<ProductConfigRow>(
      `
        SELECT brand_key, product_key, sale_price_ref, unit_weight_kg
        FROM cement_calculator_product_config
      `
    )
  ]);

  const brandMap = new Map<CementBrandId, BrandConfigRow>(
    brandResult.rows.map((row) => [row.brand_key, row])
  );
  const productMap = new Map<string, ProductConfigRow>();

  for (const row of productResult.rows) {
    productMap.set(`${row.brand_key}:${row.product_key}`, row);
  }

  return {
    brands: CEMENT_CALCULATOR_DEFINITIONS.map((definition) => {
      const savedBrand = brandMap.get(definition.id);

      return {
        id: definition.id,
        ivaRate: definition.ivaRate,
        label: definition.label,
        mulaBagsQty:
          savedBrand?.mula_bags_qty !== null &&
          savedBrand?.mula_bags_qty !== undefined &&
          Number(savedBrand.mula_bags_qty) > 0
            ? Number(savedBrand.mula_bags_qty)
            : definition.defaultMulaBagsQty,
        products: definition.products.map((product) => {
          const productKey = `${definition.id}:${product.id}`;
          const savedProduct = productMap.get(productKey);

          return {
            id: product.id,
            label: product.label,
            salePriceRef:
              savedProduct?.sale_price_ref !== null && savedProduct?.sale_price_ref !== undefined
                ? Number(savedProduct.sale_price_ref)
                : product.defaultSalePriceRef,
            unitWeightKg:
              savedProduct?.unit_weight_kg !== null && savedProduct?.unit_weight_kg !== undefined
                ? Number(savedProduct.unit_weight_kg)
                : product.defaultUnitWeightKg
          };
        }),
        totalCoteros: savedBrand ? Number(savedBrand.total_coteros) : definition.defaultTotalCoteros,
        totalMula: savedBrand ? Number(savedBrand.total_mula) : definition.defaultTotalMula
      };
    })
  };
}

export async function saveCementCalculatorConfig(
  input: CementCalculatorConfig,
  recordedByUserId: string
) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    for (const brand of input.brands) {
      const definition = getCementBrandDefinition(brand.id);

      if (!definition) {
        throw new CementCalculatorError(
          "invalid_brand",
          "La marca enviada no es valida."
        );
      }

      const totalMula = roundMoney(brand.totalMula);
      const totalCoteros = roundMoney(brand.totalCoteros);
      const mulaBagsQty = roundMoney(brand.mulaBagsQty);

      if (totalMula < 0 || totalCoteros < 0) {
        throw new CementCalculatorError(
          "invalid_amount",
          "Los totales de mula y coteros no pueden ser negativos."
        );
      }
      if (mulaBagsQty <= 0) {
        throw new CementCalculatorError(
          "invalid_amount",
          "La cantidad de bolsas base por mula debe ser mayor a cero."
        );
      }

      await client.query(
        `
          INSERT INTO cement_calculator_brand_config (
            brand_key,
            total_mula,
            total_coteros,
            mula_bags_qty,
            updated_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (brand_key)
          DO UPDATE SET
            total_mula = EXCLUDED.total_mula,
            total_coteros = EXCLUDED.total_coteros,
            mula_bags_qty = EXCLUDED.mula_bags_qty,
            updated_by_user_id = EXCLUDED.updated_by_user_id
        `,
        [
          brand.id,
          totalMula,
          totalCoteros,
          Number.isFinite(mulaBagsQty) && mulaBagsQty > 0
            ? mulaBagsQty
            : CEMENT_REFERENCE_BAGS_PER_MULA,
          recordedByUserId
        ]
      );

      const productsById = new Map(brand.products.map((product) => [product.id, product]));

      for (const defaultProduct of definition.products) {
        const productInput = productsById.get(defaultProduct.id);
        const rawSalePrice = productInput?.salePriceRef ?? null;
        const salePriceRef =
          rawSalePrice === null || rawSalePrice === undefined
            ? null
            : roundMoney(rawSalePrice);
        const rawUnitWeight = productInput?.unitWeightKg ?? null;
        const unitWeightKg =
          rawUnitWeight === null || rawUnitWeight === undefined
            ? null
            : roundMoney(rawUnitWeight);

        if (salePriceRef !== null && salePriceRef < 0) {
          throw new CementCalculatorError(
            "invalid_amount",
            "El precio referencia no puede ser negativo."
          );
        }
        if (unitWeightKg !== null && unitWeightKg < 0) {
          throw new CementCalculatorError(
            "invalid_amount",
            "El peso no puede ser negativo."
          );
        }

        await client.query(
          `
            INSERT INTO cement_calculator_product_config (
              brand_key,
              product_key,
              sale_price_ref,
              unit_weight_kg,
              updated_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (brand_key, product_key)
            DO UPDATE SET
              sale_price_ref = EXCLUDED.sale_price_ref,
              unit_weight_kg = EXCLUDED.unit_weight_kg,
              updated_by_user_id = EXCLUDED.updated_by_user_id
          `,
          [brand.id, defaultProduct.id, salePriceRef, unitWeightKg, recordedByUserId]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
