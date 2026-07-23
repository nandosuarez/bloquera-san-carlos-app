import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import type { PoolClient } from "pg";

const RECENT_LIMIT = 30;

export type ProductCategory = "GENERAL" | "RAW_MATERIAL" | "BLOCK";
export type RawMaterialType = "CEMENT" | "SAND";

type CountRow = {
  total: string;
};

type HomeStatsRow = {
  active_collaborators: string;
  active_customers: string;
  block_products: string;
  open_pending: string;
  products: string;
  today_batches: string;
};

type CustomerRow = {
  address: string | null;
  cuenti_customer_id: string | null;
  created_at: Date;
  id: string;
  identification: string | null;
  is_active: boolean;
  name: string;
  notes: string | null;
  phone: string | null;
  updated_at: Date;
};

type CollaboratorRow = {
  created_at: Date;
  daily_rate: string;
  document_number: string | null;
  full_name: string;
  id: string;
  is_active: boolean;
  notes: string | null;
  phone: string | null;
  role_title: string | null;
  updated_at: Date;
};

type ProductRow = {
  block_labor_unit_cost: string;
  category: ProductCategory;
  created_at: Date;
  cuenti_product_id: string | null;
  current_stock_qty: string;
  dimension_label: string | null;
  id: string;
  is_active: boolean;
  min_stock_qty: string;
  name: string;
  notes: string | null;
  product_line_id?: string | null;
  product_line_name?: string | null;
  raw_material_type: RawMaterialType | null;
  sale_price: string;
  sku: string | null;
  standard_cost: string;
  track_inventory: boolean;
  unit_name: string;
  updated_at: Date;
  weight_kg: string;
};

type ProductLineRow = {
  created_at: Date;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  product_count?: string;
  updated_at: Date;
};

type UserRow = {
  created_at: Date;
  email: string;
  id: string;
  is_active: boolean;
  name: string;
  role: string;
  updated_at: Date;
  username: string;
};

type BlockFormulaRow = {
  block_name: string;
  block_product_id: string;
  cement_bags_qty: string;
  cement_name: string;
  cement_product_id: string;
  id: string;
  notes: string | null;
  output_qty: string;
  sand_latas_qty: string;
  sand_name: string;
  sand_product_id: string;
};

type InventoryMovementRow = {
  created_at: Date;
  id: string;
  movement_on: Date | string;
  movement_type: string;
  notes: string | null;
  product_name: string;
  quantity: string;
  stock_after: string;
  stock_before: string;
  unit_name: string;
};

type ProductionBatchRow = {
  block_sale_price: string;
  block_name: string;
  cement_name: string;
  cement_unit_cost: string;
  cement_used_qty: string;
  collaborator_name: string;
  created_at: Date;
  id: string;
  labor_cost: string;
  labor_unit_cost: string;
  material_cost: string;
  notes: string | null;
  produced_qty: string;
  production_on: Date | string;
  sand_name: string;
  sand_unit_cost: string;
  sand_used_qty: string;
  total_cost: string;
  unit_cost: string;
};

type LaborChargeRow = {
  amount_due: string;
  charge_on: Date | string;
  collaborator_name: string;
  created_at: Date;
  id: string;
  notes: string | null;
  paid_on: Date | string | null;
  payment_notes: string | null;
  produced_qty: string;
  status: "OPEN" | "PAID";
  unit_rate: string;
};

type InventoryStatsRow = {
  active_products: string;
  block_products: string;
  low_stock_products: string;
  raw_materials: string;
  stock_cost: string;
};

type ProductionStatsRow = {
  batches: string;
  open_labor_amount: string;
  open_labor_charges: string;
  today_blocks: string;
  total_blocks: string;
  total_cost: string;
  total_margin: string;
  total_revenue: string;
};

type LaborPaymentStatsRow = {
  open_amount: string;
  open_charges: string;
  paid_amount: string;
  paid_charges: string;
};

type SelectProductRow = {
  block_labor_unit_cost: string;
  category: ProductCategory;
  current_stock_qty: string;
  id: string;
  name: string;
  raw_material_type: RawMaterialType | null;
  standard_cost: string;
  track_inventory: boolean;
  unit_name: string;
};

type ProductStockRow = {
  block_labor_unit_cost: string;
  category: ProductCategory;
  current_stock_qty: string;
  id: string;
  name: string;
  raw_material_type: RawMaterialType | null;
  standard_cost: string;
  track_inventory: boolean;
  unit_name: string;
};

type ProductForProductionRow = {
  block_labor_unit_cost: string;
  category: ProductCategory;
  current_stock_qty: string;
  id: string;
  is_active: boolean;
  name: string;
  raw_material_type: RawMaterialType | null;
  standard_cost: string;
  track_inventory: boolean;
  unit_name: string;
};

export type HomeStats = {
  activeCollaborators: number;
  activeCustomers: number;
  blockProducts: number;
  openPending: number;
  products: number;
  todayBatches: number;
};

export type Customer = {
  address: string | null;
  cuentiCustomerId: string | null;
  createdAt: Date;
  id: string;
  identification: string | null;
  isActive: boolean;
  name: string;
  notes: string | null;
  phone: string | null;
  updatedAt: Date;
};

export type Collaborator = {
  createdAt: Date;
  dailyRate: number;
  documentNumber: string | null;
  fullName: string;
  id: string;
  isActive: boolean;
  notes: string | null;
  phone: string | null;
  roleTitle: string | null;
  updatedAt: Date;
};

export type Product = {
  blockLaborUnitCost: number;
  category: ProductCategory;
  createdAt: Date;
  cuentiProductId: string | null;
  currentStockQty: number;
  dimensionLabel: string | null;
  id: string;
  isActive: boolean;
  minStockQty: number;
  name: string;
  notes: string | null;
  productLineId: string | null;
  productLineName: string | null;
  rawMaterialType: RawMaterialType | null;
  salePrice: number;
  sku: string | null;
  standardCost: number;
  trackInventory: boolean;
  unitName: string;
  updatedAt: Date;
  weightKg: number;
};

export type ProductLine = {
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  productCount: number;
  updatedAt: Date;
};

export type AppUserSummary = {
  createdAt: Date;
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  role: string;
  updatedAt: Date;
  username: string;
};

export type BlockFormula = {
  blockName: string;
  blockProductId: string;
  cementBagsQty: number;
  cementName: string;
  cementProductId: string;
  id: string;
  notes: string | null;
  outputQty: number;
  sandLatasQty: number;
  sandName: string;
  sandProductId: string;
};

export type InventoryMovement = {
  createdAt: Date;
  id: string;
  movementOn: string;
  movementType: string;
  notes: string | null;
  productName: string;
  quantity: number;
  stockAfter: number;
  stockBefore: number;
  unitName: string;
};

export type ProductionBatch = {
  blockSalePrice: number;
  blockName: string;
  cementName: string;
  cementUnitCost: number;
  cementUsedQty: number;
  collaboratorName: string;
  createdAt: Date;
  id: string;
  laborCost: number;
  laborUnitCost: number;
  materialCost: number;
  notes: string | null;
  producedQty: number;
  productionOn: string;
  sandName: string;
  sandUnitCost: number;
  sandUsedQty: number;
  totalCost: number;
  totalMargin: number | null;
  unitCost: number;
  unitMargin: number | null;
};

export type LaborCharge = {
  amountDue: number;
  chargeOn: string;
  collaboratorName: string;
  createdAt: Date;
  id: string;
  notes: string | null;
  paidOn: string | null;
  paymentNotes: string | null;
  producedQty: number;
  status: "OPEN" | "PAID";
  unitRate: number;
};

export type AdminOverview = {
  collaborators: Collaborator[];
  customers: Customer[];
  formulas: BlockFormula[];
  productLines: ProductLine[];
  products: Product[];
  stats: HomeStats;
  users: AppUserSummary[];
};

export type InventoryOverview = {
  movements: InventoryMovement[];
  products: Product[];
  stats: {
    activeProducts: number;
    blockProducts: number;
    lowStockProducts: number;
    rawMaterials: number;
    stockCost: number;
  };
};

export type ProductionOverview = {
  batches: ProductionBatch[];
  collaborators: Collaborator[];
  formulas: BlockFormula[];
  laborCharges: LaborCharge[];
  products: Product[];
  stats: {
    batches: number;
    openLaborAmount: number;
    openLaborCharges: number;
    todayBlocks: number;
    totalBlocks: number;
    totalCost: number;
    totalMargin: number;
    totalRevenue: number;
  };
};

export type LaborPaymentOverview = {
  charges: LaborCharge[];
  stats: {
    openAmount: number;
    openCharges: number;
    paidAmount: number;
    paidCharges: number;
  };
};

export class OperationsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getHomeStats(): Promise<HomeStats> {
  const result = await getDb().query<HomeStatsRow>(
    `
      SELECT
        (SELECT COUNT(*) FROM pending_delivery_account WHERE status = 'OPEN')::text AS open_pending,
        (SELECT COUNT(*) FROM customer WHERE is_active = TRUE)::text AS active_customers,
        (SELECT COUNT(*) FROM collaborator WHERE is_active = TRUE)::text AS active_collaborators,
        (SELECT COUNT(*) FROM product WHERE is_active = TRUE)::text AS products,
        (SELECT COUNT(*) FROM product WHERE is_active = TRUE AND category = 'BLOCK')::text AS block_products,
        (
          SELECT COUNT(*)
          FROM block_production_batch
          WHERE production_on = CURRENT_DATE
        )::text AS today_batches
    `
  );

  return mapHomeStats(result.rows[0]);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [stats, customers, collaborators, productLines, products, users, formulas] =
    await Promise.all([
      getHomeStats(),
      listCustomers(),
      listCollaborators(),
      listProductLines(),
      listProducts(),
      listUsers(),
      listBlockFormulas()
    ]);

  return {
    collaborators,
    customers,
    formulas,
    productLines,
    products,
    stats,
    users
  };
}

export async function getInventoryOverview(): Promise<InventoryOverview> {
  const [productsResult, movementsResult, statsResult] = await Promise.all([
    getDb().query<ProductRow>(
      `
        SELECT
          id,
          name,
          sku,
          category,
          raw_material_type,
          block_labor_unit_cost,
          dimension_label,
          unit_name,
          weight_kg,
          track_inventory,
          current_stock_qty,
          min_stock_qty,
          standard_cost,
          sale_price,
          notes,
          is_active,
          created_at,
          updated_at
        FROM product
        WHERE is_active = TRUE
          AND category IN ('RAW_MATERIAL', 'BLOCK')
          AND track_inventory = TRUE
        ORDER BY category, name
      `
    ),
    getDb().query<InventoryMovementRow>(
      `
        SELECT
          movement.id,
          movement.movement_type,
          movement.quantity,
          movement.stock_before,
          movement.stock_after,
          movement.movement_on,
          movement.notes,
          movement.created_at,
          product.name AS product_name,
          product.unit_name
        FROM inventory_movement AS movement
        INNER JOIN product
          ON product.id = movement.product_id
        WHERE product.category IN ('RAW_MATERIAL', 'BLOCK')
        ORDER BY movement.movement_on DESC, movement.created_at DESC
        LIMIT $1
      `,
      [60]
    ),
    getDb().query<InventoryStatsRow>(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE is_active = TRUE AND category IN ('RAW_MATERIAL', 'BLOCK')
          )::text AS active_products,
          COUNT(*) FILTER (WHERE is_active = TRUE AND category = 'RAW_MATERIAL')::text AS raw_materials,
          COUNT(*) FILTER (WHERE is_active = TRUE AND category = 'BLOCK')::text AS block_products,
          COUNT(*) FILTER (
            WHERE is_active = TRUE
              AND category IN ('RAW_MATERIAL', 'BLOCK')
              AND track_inventory = TRUE
              AND current_stock_qty <= min_stock_qty
          )::text AS low_stock_products,
          COALESCE(
            SUM(current_stock_qty * standard_cost) FILTER (
              WHERE track_inventory = TRUE
                AND category IN ('RAW_MATERIAL', 'BLOCK')
            ),
            0
          )::text AS stock_cost
        FROM product
      `
    )
  ]);

  const statsRow = statsResult.rows[0];

  return {
    movements: movementsResult.rows.map(mapInventoryMovement),
    products: productsResult.rows.map(mapProduct),
    stats: {
      activeProducts: Number(statsRow?.active_products ?? 0),
      blockProducts: Number(statsRow?.block_products ?? 0),
      lowStockProducts: Number(statsRow?.low_stock_products ?? 0),
      rawMaterials: Number(statsRow?.raw_materials ?? 0),
      stockCost: Number(statsRow?.stock_cost ?? 0)
    }
  };
}

export async function getProductionOverview(): Promise<ProductionOverview> {
  const [products, collaborators, formulas, batchesResult, laborChargesResult, statsResult] =
    await Promise.all([
      listProducts(),
      listCollaborators(),
      listBlockFormulas(),
      getDb().query<ProductionBatchRow>(
        `
          SELECT
            batch.id,
            batch.production_on,
            batch.produced_qty,
            batch.cement_used_qty,
            batch.sand_used_qty,
            batch.cement_unit_cost,
            batch.sand_unit_cost,
            batch.labor_unit_cost,
            batch.labor_cost,
            batch.material_cost,
            batch.total_cost,
            batch.unit_cost,
            batch.notes,
            batch.created_at,
            block.name AS block_name,
            block.sale_price::text AS block_sale_price,
            collaborator.full_name AS collaborator_name,
            COALESCE(cement.name, 'Cemento') AS cement_name,
            COALESCE(sand.name, 'Arena') AS sand_name
          FROM block_production_batch AS batch
          INNER JOIN product AS block
            ON block.id = batch.block_product_id
          INNER JOIN collaborator
            ON collaborator.id = batch.collaborator_id
          LEFT JOIN product AS cement
            ON cement.id = batch.cement_product_id
          LEFT JOIN product AS sand
            ON sand.id = batch.sand_product_id
          ORDER BY batch.production_on DESC, batch.created_at DESC
          LIMIT $1
        `,
        [RECENT_LIMIT]
      ),
      getDb().query<LaborChargeRow>(
        `
          SELECT
            charge.id,
            charge.collaborator_name,
            charge.charge_on,
            charge.paid_on,
            charge.produced_qty,
            charge.unit_rate,
            charge.amount_due,
            charge.status,
            charge.notes,
            charge.payment_notes,
            charge.created_at
          FROM production_labor_charge AS charge
          ORDER BY charge.charge_on DESC, charge.created_at DESC
          LIMIT $1
        `,
        [RECENT_LIMIT]
      ),
      getDb().query<ProductionStatsRow>(
        `
          SELECT
            COUNT(batch.id)::text AS batches,
            COALESCE(SUM(batch.produced_qty), 0)::text AS total_blocks,
            COALESCE(SUM(batch.total_cost), 0)::text AS total_cost,
            COALESCE(SUM(batch.produced_qty * block.sale_price), 0)::text AS total_revenue,
            COALESCE(SUM((batch.produced_qty * block.sale_price) - batch.total_cost), 0)::text AS total_margin,
            COALESCE(
              SUM(batch.produced_qty) FILTER (WHERE batch.production_on = CURRENT_DATE),
              0
            )::text AS today_blocks,
            COALESCE(
              SUM(labor.amount_due) FILTER (WHERE labor.status = 'OPEN'),
              0
            )::text AS open_labor_amount,
            COALESCE(
              COUNT(labor.id) FILTER (WHERE labor.status = 'OPEN'),
              0
            )::text AS open_labor_charges
          FROM block_production_batch AS batch
          INNER JOIN product AS block
            ON block.id = batch.block_product_id
          LEFT JOIN production_labor_charge AS labor
            ON labor.block_production_batch_id = batch.id
        `
      )
    ]);

  const statsRow = statsResult.rows[0];

  return {
    batches: batchesResult.rows.map(mapProductionBatch),
    collaborators,
    formulas,
    laborCharges: laborChargesResult.rows.map(mapLaborCharge),
    products,
    stats: {
      batches: Number(statsRow?.batches ?? 0),
      openLaborAmount: Number(statsRow?.open_labor_amount ?? 0),
      openLaborCharges: Number(statsRow?.open_labor_charges ?? 0),
      todayBlocks: Number(statsRow?.today_blocks ?? 0),
      totalBlocks: Number(statsRow?.total_blocks ?? 0),
      totalCost: Number(statsRow?.total_cost ?? 0),
      totalMargin: Number(statsRow?.total_margin ?? 0),
      totalRevenue: Number(statsRow?.total_revenue ?? 0)
    }
  };
}

export async function getLaborPaymentOverview(): Promise<LaborPaymentOverview> {
  const [chargesResult, statsResult] = await Promise.all([
    getDb().query<LaborChargeRow>(
      `
        SELECT
          charge.id,
          charge.collaborator_name,
          charge.charge_on,
          charge.paid_on,
          charge.produced_qty,
          charge.unit_rate,
          charge.amount_due,
          charge.status,
          charge.notes,
          charge.payment_notes,
          charge.created_at
        FROM production_labor_charge AS charge
        ORDER BY
          CASE WHEN charge.status = 'OPEN' THEN 0 ELSE 1 END,
          charge.charge_on DESC,
          charge.created_at DESC
        LIMIT $1
      `,
      [120]
    ),
    getDb().query<LaborPaymentStatsRow>(
      `
        SELECT
          COALESCE(SUM(amount_due) FILTER (WHERE status = 'OPEN'), 0)::text AS open_amount,
          COALESCE(COUNT(*) FILTER (WHERE status = 'OPEN'), 0)::text AS open_charges,
          COALESCE(SUM(amount_due) FILTER (WHERE status = 'PAID'), 0)::text AS paid_amount,
          COALESCE(COUNT(*) FILTER (WHERE status = 'PAID'), 0)::text AS paid_charges
        FROM production_labor_charge
      `
    )
  ]);

  const statsRow = statsResult.rows[0];

  return {
    charges: chargesResult.rows.map(mapLaborCharge),
    stats: {
      openAmount: Number(statsRow?.open_amount ?? 0),
      openCharges: Number(statsRow?.open_charges ?? 0),
      paidAmount: Number(statsRow?.paid_amount ?? 0),
      paidCharges: Number(statsRow?.paid_charges ?? 0)
    }
  };
}

export async function payLaborCharge(input: {
  chargeId: string;
  paidOn: string;
  paymentNotes?: string | null;
  recordedByUserId: string;
}) {
  await payLaborCharges({
    chargeIds: [input.chargeId],
    paidOn: input.paidOn,
    paymentNotes: input.paymentNotes,
    recordedByUserId: input.recordedByUserId
  });
}

export async function payLaborCharges(input: {
  chargeIds: string[];
  paidOn: string;
  paymentNotes?: string | null;
  recordedByUserId: string;
}) {
  const chargeIds = Array.from(
    new Set(input.chargeIds.map((chargeId) => chargeId.trim()).filter(Boolean))
  );

  if (chargeIds.length === 0) {
    throw new OperationsError(
      "missing_payment_selection",
      "Selecciona al menos una cuenta para pagar."
    );
  }

  const result = await getDb().query<{ id: string }>(
    `
      UPDATE production_labor_charge
      SET
        status = 'PAID',
        paid_on = $2,
        paid_by_user_id = $3,
        payment_notes = $4,
        updated_at = NOW()
      WHERE id = ANY($1::uuid[])
        AND status = 'OPEN'
      RETURNING id
    `,
    [chargeIds, input.paidOn, input.recordedByUserId, normalizeOptionalText(input.paymentNotes)]
  );

  if (result.rowCount === 0) {
    throw new OperationsError(
      "labor_charge_not_found",
      "La cuenta de cobro no existe o ya fue pagada."
    );
  }

  return result.rowCount;
}

export async function createCustomer(input: {
  address?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
}) {
  const name = normalizeLabel(input.name);

  if (!name) {
    throw new OperationsError("missing_customer_name", "Escribe el nombre del cliente.");
  }

  try {
    await getDb().query(
      `
        INSERT INTO customer (name, phone, address, notes)
        VALUES ($1, $2, $3, $4)
      `,
      [
        name,
        normalizeOptionalText(input.phone),
        normalizeOptionalText(input.address),
        normalizeOptionalText(input.notes)
      ]
    );
  } catch (error) {
    handleUniqueError(error, "duplicate_customer", "Ese cliente ya existe.");
    throw error;
  }
}

export async function createCollaborator(input: {
  dailyRate?: number;
  documentNumber?: string | null;
  fullName: string;
  notes?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
}) {
  const fullName = normalizeLabel(input.fullName);

  if (!fullName) {
    throw new OperationsError(
      "missing_collaborator_name",
      "Escribe el nombre del colaborador."
    );
  }

  try {
    await getDb().query(
      `
        INSERT INTO collaborator (
          full_name,
          role_title,
          phone,
          document_number,
          daily_rate,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        fullName,
        normalizeOptionalText(input.roleTitle),
        normalizeOptionalText(input.phone),
        normalizeOptionalText(input.documentNumber),
        roundMoney(input.dailyRate ?? 0),
        normalizeOptionalText(input.notes)
      ]
    );
  } catch (error) {
    handleUniqueError(
      error,
      "duplicate_collaborator_document",
      "Ese documento ya existe."
    );
    throw error;
  }
}

export async function createProduct(input: {
  blockLaborUnitCost?: number;
  category: ProductCategory;
  currentStockQty?: number;
  dimensionLabel?: string | null;
  minStockQty?: number;
  name: string;
  notes?: string | null;
  productLineId?: string | null;
  rawMaterialType?: RawMaterialType | null;
  salePrice?: number;
  sku?: string | null;
  standardCost?: number;
  trackInventory?: boolean;
  unitName?: string | null;
  weightKg?: number | null;
}) {
  const name = normalizeLabel(input.name);
  const shouldTrackInventory = input.category === "RAW_MATERIAL" || input.category === "BLOCK";
  const rawMaterialType =
    input.category === "RAW_MATERIAL" ? input.rawMaterialType ?? null : null;
  const blockLaborUnitCost =
    input.category === "BLOCK" ? roundMoney(input.blockLaborUnitCost ?? 0) : 0;
  const currentStockQty = shouldTrackInventory ? roundQuantity(input.currentStockQty ?? 0) : 0;
  const minStockQty = shouldTrackInventory ? roundQuantity(input.minStockQty ?? 0) : 0;
  const standardCost = shouldTrackInventory ? roundMoney(input.standardCost ?? 0) : 0;
  const productLineId = await resolveProductLineId(input.productLineId);

  if (!name) {
    throw new OperationsError("missing_product_name", "Escribe el nombre del producto.");
  }

  if (input.category === "RAW_MATERIAL" && !rawMaterialType) {
    throw new OperationsError(
      "missing_raw_material_type",
      "Selecciona si el insumo es cemento o arena."
    );
  }

  try {
    await getDb().query(
      `
        INSERT INTO product (
          name,
          sku,
          product_line_id,
          category,
          raw_material_type,
          block_labor_unit_cost,
          dimension_label,
          unit_name,
          weight_kg,
          track_inventory,
          current_stock_qty,
          min_stock_qty,
          standard_cost,
          sale_price,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `,
      [
        name,
        normalizeOptionalText(input.sku),
        productLineId,
        input.category,
        rawMaterialType,
        blockLaborUnitCost,
        normalizeOptionalText(input.dimensionLabel),
        normalizeLabel(input.unitName || "unidades"),
        roundWeight(input.weightKg ?? 0),
        shouldTrackInventory,
        currentStockQty,
        minStockQty,
        standardCost,
        roundMoney(input.salePrice ?? 0),
        normalizeOptionalText(input.notes)
      ]
    );
  } catch (error) {
    handleUniqueError(error, "duplicate_product", "Ese producto ya existe.");
    throw error;
  }
}

export async function updateProduct(input: {
  blockLaborUnitCost?: number;
  category: ProductCategory;
  currentStockQty?: number;
  dimensionLabel?: string | null;
  minStockQty?: number;
  notes?: string | null;
  productId: string;
  productLineId?: string | null;
  rawMaterialType?: RawMaterialType | null;
  salePrice?: number;
  sku?: string | null;
  standardCost?: number;
  unitName?: string | null;
  weightKg?: number | null;
}) {
  const productId = input.productId.trim();
  const shouldTrackInventory = input.category === "RAW_MATERIAL" || input.category === "BLOCK";
  const rawMaterialType =
    input.category === "RAW_MATERIAL" ? input.rawMaterialType ?? null : null;
  const blockLaborUnitCost =
    input.category === "BLOCK" ? roundMoney(input.blockLaborUnitCost ?? 0) : 0;
  const currentStockQty = shouldTrackInventory ? roundQuantity(input.currentStockQty ?? 0) : 0;
  const minStockQty = shouldTrackInventory ? roundQuantity(input.minStockQty ?? 0) : 0;
  const standardCost = shouldTrackInventory ? roundMoney(input.standardCost ?? 0) : 0;
  const productLineId = await resolveProductLineId(input.productLineId);

  if (!productId) {
    throw new OperationsError("product_not_found", "No se encontro el producto.");
  }

  if (input.category === "RAW_MATERIAL" && !rawMaterialType) {
    throw new OperationsError(
      "missing_raw_material_type",
      "Selecciona si el insumo es cemento o arena."
    );
  }

  try {
    const result = await getDb().query<{ id: string }>(
      `
        UPDATE product
        SET
          product_line_id = $2,
          sku = $3,
          category = $4,
          raw_material_type = $5,
          block_labor_unit_cost = $6,
          dimension_label = $7,
          unit_name = $8,
          weight_kg = $9,
          track_inventory = $10,
          current_stock_qty = $11,
          min_stock_qty = $12,
          standard_cost = $13,
          sale_price = $14,
          notes = $15,
          updated_at = NOW()
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id
      `,
      [
        productId,
        productLineId,
        normalizeOptionalText(input.sku),
        input.category,
        rawMaterialType,
        blockLaborUnitCost,
        normalizeOptionalText(input.dimensionLabel),
        normalizeLabel(input.unitName || "unidades"),
        roundWeight(input.weightKg ?? 0),
        shouldTrackInventory,
        currentStockQty,
        minStockQty,
        standardCost,
        roundMoney(input.salePrice ?? 0),
        normalizeOptionalText(input.notes)
      ]
    );

    if (result.rowCount === 0) {
      throw new OperationsError("product_not_found", "No se encontro el producto.");
    }
  } catch (error) {
    handleUniqueError(error, "duplicate_product", "Ese producto ya existe.");
    throw error;
  }
}

export async function createProductLine(input: {
  name: string;
  notes?: string | null;
}) {
  const name = normalizeLabel(input.name);

  if (!name) {
    throw new OperationsError(
      "missing_product_line_name",
      "Escribe el nombre de la linea."
    );
  }

  try {
    await getDb().query(
      `
        INSERT INTO product_line (name, notes)
        VALUES ($1, $2)
      `,
      [name, normalizeOptionalText(input.notes)]
    );
  } catch (error) {
    handleUniqueError(error, "duplicate_product_line", "Esa linea ya existe.");
    throw error;
  }
}

export async function setProductAsRawMaterial(input: {
  productId: string;
  rawMaterialType?: RawMaterialType | null;
  shouldBeRawMaterial: boolean;
}) {
  const productId = input.productId.trim();

  if (!productId) {
    throw new OperationsError("product_not_found", "No se encontro el producto.");
  }

  if (input.shouldBeRawMaterial && !input.rawMaterialType) {
    throw new OperationsError(
      "missing_raw_material_type",
      "Selecciona si el insumo es cemento o arena."
    );
  }

  const result = await getDb().query<{ category: ProductCategory; id: string }>(
    `
      UPDATE product
      SET
        category = CASE
          WHEN $2 THEN 'RAW_MATERIAL'
          ELSE 'GENERAL'
        END,
        raw_material_type = CASE
          WHEN $2 THEN $3
          ELSE NULL
        END,
        track_inventory = CASE
          WHEN $2 THEN TRUE
          ELSE FALSE
        END
      WHERE id = $1
        AND is_active = TRUE
        AND category <> 'BLOCK'
      RETURNING id, category
    `,
    [productId, input.shouldBeRawMaterial, input.rawMaterialType ?? null]
  );

  if (result.rowCount === 0) {
    throw new OperationsError(
      "product_not_found",
      "No se encontro el producto o no se puede cambiar esa categoria."
    );
  }
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: string;
  username: string;
}) {
  const name = normalizeLabel(input.name);
  const username = normalizeKey(input.username);
  const email = normalizeKey(input.email);

  if (!name || !username || !email || !input.password.trim()) {
    throw new OperationsError(
      "missing_user_fields",
      "Completa nombre, usuario, correo y contraseña."
    );
  }

  const passwordHash = await hashPassword(input.password.trim());

  try {
    await getDb().query(
      `
        INSERT INTO app_user (name, email, username, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [name, email, username, passwordHash, normalizeRole(input.role)]
    );
  } catch (error) {
    handleUniqueError(error, "duplicate_user", "Ese usuario o correo ya existe.");
    throw error;
  }
}

export async function saveBlockFormula(input: {
  blockProductId: string;
  cementBagsQty: number;
  cementProductId: string;
  notes?: string | null;
  outputQty: number;
  sandLatasQty: number;
  sandProductId: string;
}) {
  if (
    !input.blockProductId ||
    !input.cementProductId ||
    !input.sandProductId
  ) {
    throw new OperationsError(
      "missing_formula_fields",
      "Selecciona bloque, cemento y arena."
    );
  }

  await getDb().query(
    `
      INSERT INTO block_formula (
        block_product_id,
        cement_product_id,
        sand_product_id,
        cement_bags_qty,
        sand_latas_qty,
        output_qty,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (block_product_id)
      DO UPDATE SET
        cement_product_id = EXCLUDED.cement_product_id,
        sand_product_id = EXCLUDED.sand_product_id,
        cement_bags_qty = EXCLUDED.cement_bags_qty,
        sand_latas_qty = EXCLUDED.sand_latas_qty,
        output_qty = EXCLUDED.output_qty,
        notes = EXCLUDED.notes
    `,
    [
      input.blockProductId,
      input.cementProductId,
      input.sandProductId,
      roundQuantity(input.cementBagsQty),
      roundQuantity(input.sandLatasQty),
      roundQuantity(input.outputQty),
      normalizeOptionalText(input.notes)
    ]
  );
}

export async function recordInventoryAdjustment(input: {
  movementOn: string;
  movementType: "MANUAL_IN" | "MANUAL_OUT";
  notes?: string | null;
  productId: string;
  quantity: number;
  recordedByUserId: string;
  unitCost?: number | null;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query<ProductStockRow>(
      `
        SELECT
          id,
          name,
          category,
          raw_material_type,
          block_labor_unit_cost,
          current_stock_qty,
          standard_cost,
          track_inventory,
          unit_name
        FROM product
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.productId]
    );

    if (productResult.rowCount === 0) {
      throw new OperationsError("product_not_found", "No se encontro el producto.");
    }

    const product = productResult.rows[0];

    if (!product.track_inventory) {
      throw new OperationsError(
        "product_not_tracked",
        "Ese producto no lleva inventario."
      );
    }

    if (product.category !== "RAW_MATERIAL" && product.category !== "BLOCK") {
      throw new OperationsError(
        "product_not_tracked",
        "Solo bloques e insumos pueden manejar inventario."
      );
    }

    const quantity = roundQuantity(input.quantity);
    const stockBefore = Number(product.current_stock_qty);
    const stockAfter =
      input.movementType === "MANUAL_IN"
        ? roundQuantity(stockBefore + quantity)
        : roundQuantity(stockBefore - quantity);

    if (stockAfter < 0) {
      throw new OperationsError(
        "insufficient_stock",
        "La salida supera el inventario disponible."
      );
    }

    const normalizedUnitCost = Number.isFinite(input.unitCost ?? NaN)
      ? roundMoney(input.unitCost ?? 0)
      : null;

    await client.query(
      `
        UPDATE product
        SET
          current_stock_qty = $2,
          standard_cost = CASE
            WHEN $3::numeric IS NOT NULL
              AND $4 = 'MANUAL_IN'
              AND $3::numeric > 0
            THEN $3::numeric
            ELSE standard_cost
          END
        WHERE id = $1
      `,
      [input.productId, stockAfter, normalizedUnitCost, input.movementType]
    );

    await client.query(
      `
        INSERT INTO inventory_movement (
          product_id,
          movement_type,
          quantity,
          stock_before,
          stock_after,
          movement_on,
          notes,
          recorded_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        input.productId,
        input.movementType,
        quantity,
        stockBefore,
        stockAfter,
        input.movementOn,
        normalizeOptionalText(input.notes),
        input.recordedByUserId
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBlockProduction(input: {
  blockProductId: string;
  cementProductId: string;
  cementUsedQty: number;
  collaboratorId: string;
  laborUnitCost?: number;
  notes?: string | null;
  producedQty: number;
  productionOn: string;
  recordedByUserId: string;
  sandProductId: string;
  sandUsedQty: number;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const blockProductId = input.blockProductId.trim();
    const collaboratorId = input.collaboratorId.trim();
    const cementProductId = input.cementProductId.trim();
    const sandProductId = input.sandProductId.trim();
    const producedQty = roundQuantity(input.producedQty);
    const cementUsedQty = roundQuantity(input.cementUsedQty);
    const sandUsedQty = roundQuantity(input.sandUsedQty);
    const inputLaborUnitCost = roundMoney(input.laborUnitCost ?? 0);

    if (
      !blockProductId ||
      !collaboratorId ||
      !cementProductId ||
      !sandProductId ||
      producedQty <= 0 ||
      cementUsedQty <= 0 ||
      sandUsedQty <= 0
    ) {
      throw new OperationsError(
        "missing_production_fields",
        "Completa bloque, insumos, colaborador, cantidad y fecha."
      );
    }

    const collaboratorResult = await client.query<{ full_name: string; id: string }>(
      `
        SELECT id, full_name
        FROM collaborator
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
      `,
      [collaboratorId]
    );

    if (collaboratorResult.rowCount === 0) {
      throw new OperationsError(
        "collaborator_not_found",
        "Selecciona un colaborador activo."
      );
    }
    const collaborator = collaboratorResult.rows[0];

    const blockResult = await client.query<ProductForProductionRow>(
      `
        SELECT
          id,
          name,
          category,
          raw_material_type,
          block_labor_unit_cost,
          current_stock_qty,
          standard_cost,
          track_inventory,
          unit_name,
          is_active
        FROM product
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [blockProductId]
    );

    if (blockResult.rowCount === 0) {
      throw new OperationsError(
        "block_not_found",
        "Selecciona un bloque valido."
      );
    }

    const cementResult = await client.query<ProductForProductionRow>(
      `
        SELECT
          id,
          name,
          category,
          raw_material_type,
          block_labor_unit_cost,
          current_stock_qty,
          standard_cost,
          track_inventory,
          unit_name,
          is_active
        FROM product
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [cementProductId]
    );

    const sandResult = await client.query<ProductForProductionRow>(
      `
        SELECT
          id,
          name,
          category,
          raw_material_type,
          block_labor_unit_cost,
          current_stock_qty,
          standard_cost,
          track_inventory,
          unit_name,
          is_active
        FROM product
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [sandProductId]
    );

    if (
      cementResult.rowCount === 0 ||
      sandResult.rowCount === 0
    ) {
      throw new OperationsError(
        "raw_material_not_found",
        "Selecciona insumos validos para cemento y arena."
      );
    }

    const block = blockResult.rows[0];
    const cement = cementResult.rows[0];
    const sand = sandResult.rows[0];

    if (block.category !== "BLOCK") {
      throw new OperationsError("block_not_found", "Selecciona un bloque valido.");
    }

    if (!block.track_inventory) {
      throw new OperationsError(
        "block_not_tracked",
        "El bloque seleccionado debe llevar inventario."
      );
    }

    if (!cement.track_inventory || !sand.track_inventory) {
      throw new OperationsError(
        "raw_material_not_tracked",
        "Cemento y arena deben llevar inventario."
      );
    }

    if (cement.raw_material_type !== "CEMENT") {
      throw new OperationsError(
        "raw_material_not_found",
        "En el campo cemento solo puedes seleccionar insumos tipo cemento."
      );
    }

    if (sand.raw_material_type !== "SAND") {
      throw new OperationsError(
        "raw_material_not_found",
        "En el campo arena solo puedes seleccionar insumos tipo arena."
      );
    }

    if (
      Number(cement.current_stock_qty) < cementUsedQty ||
      Number(sand.current_stock_qty) < sandUsedQty
    ) {
      throw new OperationsError(
        "insufficient_raw_material",
        "No hay suficiente materia prima para registrar esa produccion."
      );
    }

    const cementStockBefore = Number(cement.current_stock_qty);
    const sandStockBefore = Number(sand.current_stock_qty);
    const blockStockBefore = Number(block.current_stock_qty);
    const cementStockAfter = roundQuantity(cementStockBefore - cementUsedQty);
    const sandStockAfter = roundQuantity(sandStockBefore - sandUsedQty);
    const blockStockAfter = roundQuantity(blockStockBefore + producedQty);
    const cementUnitCost = roundMoney(Number(cement.standard_cost));
    const sandUnitCost = roundMoney(Number(sand.standard_cost));
    const defaultLaborUnitCost = roundMoney(Number(block.block_labor_unit_cost));
    const laborUnitCost =
      inputLaborUnitCost > 0 ? inputLaborUnitCost : defaultLaborUnitCost;
    const laborCost = roundMoney(laborUnitCost * producedQty);
    const materialCost = roundMoney(
      cementUsedQty * cementUnitCost +
        sandUsedQty * sandUnitCost
    );
    const totalCost = roundMoney(materialCost + laborCost);
    const unitCost = roundMoney(totalCost / producedQty);

    const batchResult = await client.query<{ id: string }>(
      `
        INSERT INTO block_production_batch (
          block_product_id,
          cement_product_id,
          sand_product_id,
          collaborator_id,
          production_on,
          produced_qty,
          cement_used_qty,
          sand_used_qty,
          cement_unit_cost,
          sand_unit_cost,
          labor_unit_cost,
          labor_cost,
          material_cost,
          total_cost,
          unit_cost,
          notes,
          recorded_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        RETURNING id
      `,
      [
        blockProductId,
        cement.id,
        sand.id,
        collaboratorId,
        input.productionOn,
        producedQty,
        cementUsedQty,
        sandUsedQty,
        cementUnitCost,
        sandUnitCost,
        laborUnitCost,
        laborCost,
        materialCost,
        totalCost,
        unitCost,
        normalizeOptionalText(input.notes),
        input.recordedByUserId
      ]
    );

    const batchId = batchResult.rows[0].id;

    await client.query(
      `
        UPDATE product
        SET current_stock_qty = $2
        WHERE id = $1
      `,
      [cement.id, cementStockAfter]
    );

    await client.query(
      `
        UPDATE product
        SET current_stock_qty = $2
        WHERE id = $1
      `,
      [sand.id, sandStockAfter]
    );

    await client.query(
      `
        UPDATE product
        SET
          current_stock_qty = $2,
          standard_cost = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [block.id, blockStockAfter, unitCost]
    );

    await insertInventoryMovement(client, {
      blockProductionBatchId: batchId,
      movementOn: input.productionOn,
      movementType: "PRODUCTION_OUT",
      notes: normalizeOptionalText(input.notes),
      productId: cement.id,
      quantity: cementUsedQty,
      recordedByUserId: input.recordedByUserId,
      stockAfter: cementStockAfter,
      stockBefore: cementStockBefore
    });

    await insertInventoryMovement(client, {
      blockProductionBatchId: batchId,
      movementOn: input.productionOn,
      movementType: "PRODUCTION_OUT",
      notes: normalizeOptionalText(input.notes),
      productId: sand.id,
      quantity: sandUsedQty,
      recordedByUserId: input.recordedByUserId,
      stockAfter: sandStockAfter,
      stockBefore: sandStockBefore
    });

    await insertInventoryMovement(client, {
      blockProductionBatchId: batchId,
      movementOn: input.productionOn,
      movementType: "PRODUCTION_IN",
      notes: normalizeOptionalText(input.notes),
      productId: block.id,
      quantity: producedQty,
      recordedByUserId: input.recordedByUserId,
      stockAfter: blockStockAfter,
      stockBefore: blockStockBefore
    });

    await client.query(
      `
        INSERT INTO production_labor_charge (
          block_production_batch_id,
          collaborator_id,
          collaborator_name,
          charge_on,
          produced_qty,
          unit_rate,
          amount_due,
          notes,
          recorded_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        batchId,
        collaboratorId,
        collaborator.full_name,
        input.productionOn,
        producedQty,
        laborUnitCost,
        laborCost,
        normalizeOptionalText(input.notes),
        input.recordedByUserId
      ]
    );

    await client.query("COMMIT");

    return { batchId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCustomers(): Promise<Customer[]> {
  const result = await getDb().query<CustomerRow>(
    `
      SELECT
        id,
        name,
        cuenti_customer_id,
        identification,
        phone,
        address,
        notes,
        is_active,
        created_at,
        updated_at
      FROM customer
      ORDER BY name
    `
  );

  return result.rows.map(mapCustomer);
}

async function listCollaborators(): Promise<Collaborator[]> {
  const result = await getDb().query<CollaboratorRow>(
    `
      SELECT
        id,
        full_name,
        role_title,
        phone,
        document_number,
        daily_rate,
        notes,
        is_active,
        created_at,
        updated_at
      FROM collaborator
      ORDER BY full_name
    `
  );

  return result.rows.map(mapCollaborator);
}

async function listProducts(): Promise<Product[]> {
  const result = await getDb().query<ProductRow>(
    `
      SELECT
        product.id,
        product.name,
        product.sku,
        product.cuenti_product_id,
        product.product_line_id,
        line.name AS product_line_name,
        product.category,
        product.raw_material_type,
        product.block_labor_unit_cost,
        product.dimension_label,
        product.unit_name,
        product.weight_kg,
        product.track_inventory,
        product.current_stock_qty,
        product.min_stock_qty,
        product.standard_cost,
        product.sale_price,
        product.notes,
        product.is_active,
        product.created_at,
        product.updated_at
      FROM product
      LEFT JOIN product_line AS line
        ON line.id = product.product_line_id
      ORDER BY product.category, product.name
    `
  );

  return result.rows.map(mapProduct);
}

async function listProductLines(): Promise<ProductLine[]> {
  const result = await getDb().query<ProductLineRow>(
    `
      SELECT
        line.id,
        line.name,
        line.notes,
        line.is_active,
        line.created_at,
        line.updated_at,
        COUNT(product.id)::text AS product_count
      FROM product_line AS line
      LEFT JOIN product
        ON product.product_line_id = line.id
        AND product.is_active = TRUE
      GROUP BY
        line.id,
        line.name,
        line.notes,
        line.is_active,
        line.created_at,
        line.updated_at
      ORDER BY line.name
    `
  );

  return result.rows.map(mapProductLine);
}

async function listUsers(): Promise<AppUserSummary[]> {
  const result = await getDb().query<UserRow>(
    `
      SELECT
        id,
        name,
        username,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM app_user
      ORDER BY name
    `
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    role: row.role,
    updatedAt: row.updated_at,
    username: row.username
  }));
}

async function listBlockFormulas(): Promise<BlockFormula[]> {
  const result = await getDb().query<BlockFormulaRow>(
    `
      SELECT
        formula.id,
        formula.block_product_id,
        formula.cement_product_id,
        formula.sand_product_id,
        formula.cement_bags_qty,
        formula.sand_latas_qty,
        formula.output_qty,
        formula.notes,
        block.name AS block_name,
        cement.name AS cement_name,
        sand.name AS sand_name
      FROM block_formula AS formula
      INNER JOIN product AS block
        ON block.id = formula.block_product_id
      INNER JOIN product AS cement
        ON cement.id = formula.cement_product_id
      INNER JOIN product AS sand
        ON sand.id = formula.sand_product_id
      ORDER BY block.name
    `
  );

  return result.rows.map((row) => ({
    blockName: row.block_name,
    blockProductId: row.block_product_id,
    cementBagsQty: Number(row.cement_bags_qty),
    cementName: row.cement_name,
    cementProductId: row.cement_product_id,
    id: row.id,
    notes: row.notes,
    outputQty: Number(row.output_qty),
    sandLatasQty: Number(row.sand_latas_qty),
    sandName: row.sand_name,
    sandProductId: row.sand_product_id
  }));
}

function mapHomeStats(row: HomeStatsRow | undefined): HomeStats {
  return {
    activeCollaborators: Number(row?.active_collaborators ?? 0),
    activeCustomers: Number(row?.active_customers ?? 0),
    blockProducts: Number(row?.block_products ?? 0),
    openPending: Number(row?.open_pending ?? 0),
    products: Number(row?.products ?? 0),
    todayBatches: Number(row?.today_batches ?? 0)
  };
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    address: row.address,
    cuentiCustomerId: row.cuenti_customer_id,
    createdAt: row.created_at,
    id: row.id,
    identification: row.identification,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes,
    phone: row.phone,
    updatedAt: row.updated_at
  };
}

function mapCollaborator(row: CollaboratorRow): Collaborator {
  return {
    createdAt: row.created_at,
    dailyRate: Number(row.daily_rate),
    documentNumber: row.document_number,
    fullName: row.full_name,
    id: row.id,
    isActive: row.is_active,
    notes: row.notes,
    phone: row.phone,
    roleTitle: row.role_title,
    updatedAt: row.updated_at
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    blockLaborUnitCost: Number(row.block_labor_unit_cost),
    category: row.category,
    createdAt: row.created_at,
    cuentiProductId: row.cuenti_product_id,
    currentStockQty: Number(row.current_stock_qty),
    dimensionLabel: row.dimension_label,
    id: row.id,
    isActive: row.is_active,
    minStockQty: Number(row.min_stock_qty),
    name: row.name,
    notes: row.notes,
    productLineId: row.product_line_id ?? null,
    productLineName: row.product_line_name ?? null,
    rawMaterialType: row.raw_material_type,
    salePrice: Number(row.sale_price),
    sku: row.sku,
    standardCost: Number(row.standard_cost),
    trackInventory: row.track_inventory,
    unitName: row.unit_name,
    updatedAt: row.updated_at,
    weightKg: Number(row.weight_kg)
  };
}

function mapProductLine(row: ProductLineRow): ProductLine {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes,
    productCount: Number(row.product_count ?? 0),
    updatedAt: row.updated_at
  };
}

function mapInventoryMovement(row: InventoryMovementRow): InventoryMovement {
  return {
    createdAt: row.created_at,
    id: row.id,
    movementOn: normalizeDateOnly(row.movement_on),
    movementType: row.movement_type,
    notes: row.notes,
    productName: row.product_name,
    quantity: Number(row.quantity),
    stockAfter: Number(row.stock_after),
    stockBefore: Number(row.stock_before),
    unitName: row.unit_name
  };
}

function mapProductionBatch(row: ProductionBatchRow): ProductionBatch {
  const blockSalePrice = Number(row.block_sale_price);
  const unitCost = Number(row.unit_cost);
  const producedQty = Number(row.produced_qty);
  const unitMargin = blockSalePrice > 0 ? blockSalePrice - unitCost : null;
  const totalMargin = unitMargin !== null ? unitMargin * producedQty : null;

  return {
    blockSalePrice,
    blockName: row.block_name,
    cementName: row.cement_name,
    cementUnitCost: Number(row.cement_unit_cost),
    cementUsedQty: Number(row.cement_used_qty),
    collaboratorName: row.collaborator_name,
    createdAt: row.created_at,
    id: row.id,
    laborCost: Number(row.labor_cost),
    laborUnitCost: Number(row.labor_unit_cost),
    materialCost: Number(row.material_cost),
    notes: row.notes,
    producedQty,
    productionOn: normalizeDateOnly(row.production_on),
    sandName: row.sand_name,
    sandUnitCost: Number(row.sand_unit_cost),
    sandUsedQty: Number(row.sand_used_qty),
    totalCost: Number(row.total_cost),
    totalMargin,
    unitCost,
    unitMargin
  };
}

function mapLaborCharge(row: LaborChargeRow): LaborCharge {
  return {
    amountDue: Number(row.amount_due),
    chargeOn: normalizeDateOnly(row.charge_on),
    collaboratorName: row.collaborator_name,
    createdAt: row.created_at,
    id: row.id,
    notes: row.notes,
    paidOn: row.paid_on ? normalizeDateOnly(row.paid_on) : null,
    paymentNotes: row.payment_notes,
    producedQty: Number(row.produced_qty),
    status: row.status,
    unitRate: Number(row.unit_rate)
  };
}

async function insertInventoryMovement(
  client: PoolClient,
  input: {
    blockProductionBatchId?: string | null;
    movementOn: string;
    movementType: string;
    notes?: string | null;
    productId: string;
    quantity: number;
    recordedByUserId: string;
    stockAfter: number;
    stockBefore: number;
  }
) {
  await client.query(
    `
      INSERT INTO inventory_movement (
        product_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        movement_on,
        notes,
        block_production_batch_id,
        recorded_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      input.productId,
      input.movementType,
      roundQuantity(input.quantity),
      roundQuantity(input.stockBefore),
      roundQuantity(input.stockAfter),
      input.movementOn,
      normalizeOptionalText(input.notes),
      input.blockProductionBatchId ?? null,
      input.recordedByUserId
    ]
  );
}

async function resolveProductLineId(productLineId?: string | null) {
  const normalizedId = normalizeOptionalText(productLineId);

  if (!normalizedId) return null;

  const result = await getDb().query<{ id: string }>(
    `
      SELECT id
      FROM product_line
      WHERE id::text = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [normalizedId]
  );

  if (result.rowCount === 0) {
    throw new OperationsError("product_line_not_found", "Selecciona una linea valida.");
  }

  return result.rows[0].id;
}

function handleUniqueError(error: unknown, code: string, message: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    throw new OperationsError(code, message);
  }

  throw error;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeKey(value: string) {
  return normalizeLabel(value).toLocaleLowerCase("es-CO");
}

function normalizeRole(role: string) {
  const normalized = normalizeLabel(role).toLocaleUpperCase("es-CO");

  return normalized || "ADMIN";
}

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeDateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
