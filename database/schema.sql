CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  username VARCHAR(80),
  password_hash TEXT NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'ADMIN',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS username VARCHAR(80);

UPDATE app_user
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL OR BTRIM(username) = '';

ALTER TABLE app_user
ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_username_unique
  ON app_user (LOWER(username));

DROP TRIGGER IF EXISTS trg_app_user_updated_at ON app_user;

CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES app_user(id),
  actor_name VARCHAR(160) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID NULL,
  summary TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON audit_log (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  cuenti_customer_id VARCHAR(80) NULL,
  identification VARCHAR(80) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_name_unique
  ON customer (LOWER(name));

ALTER TABLE customer
ADD COLUMN IF NOT EXISTS cuenti_customer_id VARCHAR(80) NULL;

ALTER TABLE customer
ADD COLUMN IF NOT EXISTS identification VARCHAR(80) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_cuenti_customer_id_unique
  ON customer (cuenti_customer_id)
  WHERE cuenti_customer_id IS NOT NULL AND BTRIM(cuenti_customer_id) <> '';

CREATE INDEX IF NOT EXISTS customer_identification_idx
  ON customer (identification)
  WHERE identification IS NOT NULL AND BTRIM(identification) <> '';

DROP TRIGGER IF EXISTS trg_customer_updated_at ON customer;

CREATE TRIGGER trg_customer_updated_at
BEFORE UPDATE ON customer
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS collaborator (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  role_title VARCHAR(80) NULL,
  phone VARCHAR(40) NULL,
  document_number VARCHAR(40) NULL,
  daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collaborator_document_unique
  ON collaborator (document_number)
  WHERE document_number IS NOT NULL AND BTRIM(document_number) <> '';

DROP TRIGGER IF EXISTS trg_collaborator_updated_at ON collaborator;

CREATE TRIGGER trg_collaborator_updated_at
BEFORE UPDATE ON collaborator
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS product_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_line_name_unique
  ON product_line (LOWER(name));

DROP TRIGGER IF EXISTS trg_product_line_updated_at ON product_line;

CREATE TRIGGER trg_product_line_updated_at
BEFORE UPDATE ON product_line
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS product (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(60) NULL,
  cuenti_product_id VARCHAR(80) NULL,
  cuenti_stock_qty NUMERIC(14, 2) NULL,
  cuenti_stock_synced_at TIMESTAMPTZ NULL,
  product_line_id UUID NULL REFERENCES product_line(id),
  category VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
  raw_material_type VARCHAR(20) NULL,
  block_labor_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  dimension_label VARCHAR(80) NULL,
  unit_name VARCHAR(40) NOT NULL DEFAULT 'unidades',
  weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  current_stock_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
  min_stock_qty NUMERIC(14, 2) NOT NULL DEFAULT 0,
  standard_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_category_check
    CHECK (category IN ('GENERAL', 'RAW_MATERIAL', 'BLOCK')),
  CONSTRAINT product_raw_material_type_check
    CHECK (raw_material_type IN ('CEMENT', 'SAND') OR raw_material_type IS NULL),
  CONSTRAINT product_quantity_check
    CHECK (
      current_stock_qty >= 0
      AND min_stock_qty >= 0
      AND standard_cost >= 0
      AND block_labor_unit_cost >= 0
      AND sale_price >= 0
      AND weight_kg >= 0
      AND (cuenti_stock_qty IS NULL OR cuenti_stock_qty >= 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_name_unique
  ON product (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS product_sku_unique
  ON product (LOWER(sku))
  WHERE sku IS NOT NULL AND BTRIM(sku) <> '';

DROP TRIGGER IF EXISTS trg_product_updated_at ON product;

CREATE TRIGGER trg_product_updated_at
BEFORE UPDATE ON product
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE product
ADD COLUMN IF NOT EXISTS raw_material_type VARCHAR(20) NULL;

ALTER TABLE product
ADD COLUMN IF NOT EXISTS cuenti_product_id VARCHAR(80) NULL;

ALTER TABLE product
ADD COLUMN IF NOT EXISTS cuenti_stock_qty NUMERIC(14, 2) NULL;

ALTER TABLE product
ADD COLUMN IF NOT EXISTS cuenti_stock_synced_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_cuenti_product_id_unique
  ON product (cuenti_product_id)
  WHERE cuenti_product_id IS NOT NULL AND BTRIM(cuenti_product_id) <> '';

ALTER TABLE product
ADD COLUMN IF NOT EXISTS block_labor_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE product
ADD COLUMN IF NOT EXISTS product_line_id UUID NULL REFERENCES product_line(id);

ALTER TABLE product
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE product
DROP CONSTRAINT IF EXISTS product_quantity_check;

ALTER TABLE product
ADD CONSTRAINT product_quantity_check
CHECK (
  current_stock_qty >= 0
  AND min_stock_qty >= 0
  AND standard_cost >= 0
  AND block_labor_unit_cost >= 0
  AND sale_price >= 0
  AND weight_kg >= 0
  AND (cuenti_stock_qty IS NULL OR cuenti_stock_qty >= 0)
);

CREATE INDEX IF NOT EXISTS product_product_line_idx
  ON product (product_line_id);

ALTER TABLE product
DROP CONSTRAINT IF EXISTS product_raw_material_type_check;

ALTER TABLE product
ADD CONSTRAINT product_raw_material_type_check
CHECK (raw_material_type IN ('CEMENT', 'SAND') OR raw_material_type IS NULL);

UPDATE product
SET track_inventory = FALSE
WHERE category = 'GENERAL'
  AND track_inventory = TRUE;

CREATE TABLE IF NOT EXISTS inventory_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  movement_type VARCHAR(30) NOT NULL,
  quantity NUMERIC(14, 2) NOT NULL,
  stock_before NUMERIC(14, 2) NOT NULL,
  stock_after NUMERIC(14, 2) NOT NULL,
  movement_on DATE NOT NULL,
  notes TEXT NULL,
  block_production_batch_id UUID NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movement_type_check
    CHECK (
      movement_type IN (
        'MANUAL_IN',
        'MANUAL_OUT',
        'PRODUCTION_IN',
        'PRODUCTION_OUT',
        'ADJUSTMENT_IN',
        'ADJUSTMENT_OUT'
      )
    ),
  CONSTRAINT inventory_movement_quantity_check
    CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS inventory_movement_product_idx
  ON inventory_movement (product_id, movement_on DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS block_formula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_product_id UUID NOT NULL UNIQUE REFERENCES product(id) ON DELETE CASCADE,
  cement_product_id UUID NOT NULL REFERENCES product(id),
  sand_product_id UUID NOT NULL REFERENCES product(id),
  cement_bags_qty NUMERIC(12, 2) NOT NULL,
  sand_latas_qty NUMERIC(12, 2) NOT NULL,
  output_qty NUMERIC(12, 2) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT block_formula_quantity_check
    CHECK (
      cement_bags_qty > 0
      AND sand_latas_qty > 0
      AND output_qty > 0
    )
);

DROP TRIGGER IF EXISTS trg_block_formula_updated_at ON block_formula;

CREATE TRIGGER trg_block_formula_updated_at
BEFORE UPDATE ON block_formula
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS block_production_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_product_id UUID NOT NULL REFERENCES product(id),
  cement_product_id UUID NULL REFERENCES product(id),
  sand_product_id UUID NULL REFERENCES product(id),
  collaborator_id UUID NOT NULL REFERENCES collaborator(id),
  production_on DATE NOT NULL,
  produced_qty NUMERIC(12, 2) NOT NULL,
  cement_used_qty NUMERIC(12, 2) NOT NULL,
  sand_used_qty NUMERIC(12, 2) NOT NULL,
  cement_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sand_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  labor_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  labor_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  material_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT block_production_batch_quantity_check
    CHECK (
      produced_qty > 0
      AND cement_used_qty > 0
      AND sand_used_qty > 0
      AND cement_unit_cost >= 0
      AND sand_unit_cost >= 0
      AND labor_unit_cost >= 0
      AND labor_cost >= 0
      AND material_cost >= 0
      AND total_cost >= 0
      AND unit_cost >= 0
    )
);

CREATE INDEX IF NOT EXISTS block_production_batch_date_idx
  ON block_production_batch (production_on DESC, created_at DESC);

ALTER TABLE block_production_batch
ADD COLUMN IF NOT EXISTS cement_product_id UUID NULL REFERENCES product(id);

ALTER TABLE block_production_batch
ADD COLUMN IF NOT EXISTS sand_product_id UUID NULL REFERENCES product(id);

ALTER TABLE block_production_batch
ADD COLUMN IF NOT EXISTS cement_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE block_production_batch
ADD COLUMN IF NOT EXISTS sand_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE block_production_batch
ADD COLUMN IF NOT EXISTS labor_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0;

UPDATE block_production_batch AS batch
SET
  cement_product_id = COALESCE(batch.cement_product_id, formula.cement_product_id),
  sand_product_id = COALESCE(batch.sand_product_id, formula.sand_product_id)
FROM block_formula AS formula
WHERE formula.block_product_id = batch.block_product_id
  AND (batch.cement_product_id IS NULL OR batch.sand_product_id IS NULL);

ALTER TABLE inventory_movement
DROP CONSTRAINT IF EXISTS inventory_movement_batch_fk;

ALTER TABLE inventory_movement
ADD CONSTRAINT inventory_movement_batch_fk
FOREIGN KEY (block_production_batch_id)
REFERENCES block_production_batch(id)
ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS production_labor_charge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_production_batch_id UUID NOT NULL UNIQUE REFERENCES block_production_batch(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES collaborator(id),
  collaborator_name VARCHAR(160) NOT NULL,
  charge_on DATE NOT NULL,
  paid_on DATE NULL,
  paid_by_user_id UUID NULL REFERENCES app_user(id),
  produced_qty NUMERIC(12, 2) NOT NULL,
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  notes TEXT NULL,
  payment_notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT production_labor_charge_values_check
    CHECK (
      produced_qty >= 0
      AND unit_rate >= 0
      AND amount_due >= 0
    ),
  CONSTRAINT production_labor_charge_status_check
    CHECK (status IN ('OPEN', 'PAID'))
);

CREATE INDEX IF NOT EXISTS production_labor_charge_date_idx
  ON production_labor_charge (charge_on DESC, created_at DESC);

ALTER TABLE production_labor_charge
ADD COLUMN IF NOT EXISTS paid_on DATE NULL;

ALTER TABLE production_labor_charge
ADD COLUMN IF NOT EXISTS paid_by_user_id UUID NULL REFERENCES app_user(id);

ALTER TABLE production_labor_charge
ADD COLUMN IF NOT EXISTS payment_notes TEXT NULL;

DROP TRIGGER IF EXISTS trg_production_labor_charge_updated_at
  ON production_labor_charge;

CREATE TRIGGER trg_production_labor_charge_updated_at
BEFORE UPDATE ON production_labor_charge
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS delivery_vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(120) NOT NULL,
  plate VARCHAR(40) NULL,
  max_load_kg NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE delivery_vehicle
ADD COLUMN IF NOT EXISTS max_load_kg NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE delivery_vehicle
DROP CONSTRAINT IF EXISTS delivery_vehicle_load_check;

ALTER TABLE delivery_vehicle
ADD CONSTRAINT delivery_vehicle_load_check
CHECK (max_load_kg >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_vehicle_label_unique
  ON delivery_vehicle (LOWER(label));

CREATE UNIQUE INDEX IF NOT EXISTS delivery_vehicle_plate_unique
  ON delivery_vehicle (LOWER(plate))
  WHERE plate IS NOT NULL AND BTRIM(plate) <> '';

DROP TRIGGER IF EXISTS trg_delivery_vehicle_updated_at ON delivery_vehicle;

CREATE TRIGGER trg_delivery_vehicle_updated_at
BEFORE UPDATE ON delivery_vehicle
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS transport_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS transport_provider_name_unique
  ON transport_provider (LOWER(name));

DROP TRIGGER IF EXISTS trg_transport_provider_updated_at ON transport_provider;

CREATE TRIGGER trg_transport_provider_updated_at
BEFORE UPDATE ON transport_provider
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS transport_cost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_on DATE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES delivery_vehicle(id),
  vehicle_label VARCHAR(120) NOT NULL,
  cost_type VARCHAR(20) NOT NULL,
  concept VARCHAR(160) NOT NULL,
  provider_id UUID NULL REFERENCES transport_provider(id),
  provider_name VARCHAR(160) NULL,
  vendor VARCHAR(160) NULL,
  odometer_km NUMERIC(12, 2) NULL,
  quantity NUMERIC(12, 2) NULL,
  unit_cost NUMERIC(14, 2) NULL,
  total_cost NUMERIC(14, 2) NOT NULL,
  notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at TIMESTAMPTZ NULL,
  voided_by_user_id UUID NULL REFERENCES app_user(id),
  void_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transport_cost_type_check
    CHECK (cost_type IN ('FUEL', 'MAINTENANCE', 'REPAIR')),
  CONSTRAINT transport_cost_values_check
    CHECK (
      total_cost >= 0
      AND (odometer_km IS NULL OR odometer_km >= 0)
      AND (quantity IS NULL OR quantity > 0)
      AND (unit_cost IS NULL OR unit_cost >= 0)
    )
);

CREATE INDEX IF NOT EXISTS transport_cost_date_idx
  ON transport_cost (cost_on DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS transport_cost_vehicle_idx
  ON transport_cost (vehicle_id, cost_on DESC, created_at DESC);

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS provider_id UUID NULL REFERENCES transport_provider(id);

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(160) NULL;

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS voided_by_user_id UUID NULL REFERENCES app_user(id);

ALTER TABLE transport_cost
ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

UPDATE transport_cost
SET provider_name = COALESCE(provider_name, vendor)
WHERE provider_name IS NULL
  AND vendor IS NOT NULL;

DROP TRIGGER IF EXISTS trg_transport_cost_updated_at ON transport_cost;

CREATE TRIGGER trg_transport_cost_updated_at
BEFORE UPDATE ON transport_cost
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS operating_expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_on DATE NOT NULL,
  category VARCHAR(30) NOT NULL,
  concept VARCHAR(180) NOT NULL,
  provider_id UUID NULL REFERENCES transport_provider(id),
  provider_name VARCHAR(160) NULL,
  total_amount NUMERIC(16, 2) NOT NULL,
  payment_method VARCHAR(120) NULL,
  notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at TIMESTAMPTZ NULL,
  voided_by_user_id UUID NULL REFERENCES app_user(id),
  void_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operating_expense_category_check
    CHECK (
      category IN (
        'SERVICES',
        'RENT',
        'PAYROLL',
        'SUPPLIES',
        'TAX',
        'SECURITY',
        'OTHER'
      )
    ),
  CONSTRAINT operating_expense_amount_check
    CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS operating_expense_date_idx
  ON operating_expense (expense_on DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_operating_expense_updated_at ON operating_expense;

CREATE TRIGGER trg_operating_expense_updated_at
BEFORE UPDATE ON operating_expense
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS delivery_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_on DATE NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_address TEXT NOT NULL,
  vehicle_id UUID NULL REFERENCES delivery_vehicle(id),
  vehicle_label VARCHAR(120) NOT NULL,
  collaborator_id UUID NOT NULL REFERENCES collaborator(id),
  departure_on DATE NULL,
  departure_time TIME NULL,
  completion_on DATE NULL,
  completion_time TIME NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROGRAMMED',
  notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  canceled_at TIMESTAMPTZ NULL,
  canceled_by_user_id UUID NULL REFERENCES app_user(id),
  cancel_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_service_status_check
    CHECK (status IN ('PROGRAMMED', 'STARTED', 'COMPLETED', 'CANCELED'))
);

DROP TRIGGER IF EXISTS trg_delivery_service_updated_at ON delivery_service;

CREATE TRIGGER trg_delivery_service_updated_at
BEFORE UPDATE ON delivery_service
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS delivery_service_date_idx
  ON delivery_service (service_on DESC, departure_time DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS delivery_service_status_idx
  ON delivery_service (status, service_on DESC);

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS vehicle_id UUID NULL REFERENCES delivery_vehicle(id);

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS departure_on DATE NULL;

ALTER TABLE delivery_service
ALTER COLUMN departure_time DROP NOT NULL;

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS completion_on DATE NULL;

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS completion_time TIME NULL;

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ NULL;

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS canceled_by_user_id UUID NULL REFERENCES app_user(id);

ALTER TABLE delivery_service
ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL;

ALTER TABLE delivery_service
DROP CONSTRAINT IF EXISTS delivery_service_status_check;

ALTER TABLE delivery_service
ADD CONSTRAINT delivery_service_status_check
CHECK (status IN ('PROGRAMMED', 'STARTED', 'COMPLETED', 'CANCELED'));

UPDATE delivery_service
SET status = CASE
  WHEN status = 'COMPLETED' THEN 'COMPLETED'
  WHEN departure_time IS NOT NULL THEN 'STARTED'
  ELSE 'PROGRAMMED'
END
WHERE status IN ('OPEN', 'COMPLETED');

UPDATE delivery_service
SET departure_on = COALESCE(departure_on, service_on)
WHERE departure_time IS NOT NULL;

UPDATE delivery_service
SET
  completion_on = COALESCE(completion_on, service_on),
  completion_time = COALESCE(completion_time, departure_time)
WHERE status = 'COMPLETED';

CREATE TABLE IF NOT EXISTS delivery_service_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES delivery_service(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id),
  product_name VARCHAR(160) NOT NULL,
  product_line_id UUID NULL REFERENCES product_line(id),
  product_line_name VARCHAR(120) NULL,
  unit_name VARCHAR(40) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  trip_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_service_item_quantity_check
    CHECK (quantity > 0),
  CONSTRAINT delivery_service_item_trip_count_check
    CHECK (trip_count > 0)
);

CREATE INDEX IF NOT EXISTS delivery_service_item_service_idx
  ON delivery_service_item (service_id, created_at ASC);

ALTER TABLE delivery_service_item
ADD COLUMN IF NOT EXISTS product_line_id UUID NULL REFERENCES product_line(id);

ALTER TABLE delivery_service_item
ADD COLUMN IF NOT EXISTS product_line_name VARCHAR(120) NULL;

ALTER TABLE delivery_service_item
ADD COLUMN IF NOT EXISTS trip_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE delivery_service_item
DROP CONSTRAINT IF EXISTS delivery_service_item_trip_count_check;

ALTER TABLE delivery_service_item
ADD CONSTRAINT delivery_service_item_trip_count_check
CHECK (trip_count > 0);

UPDATE delivery_service_item AS item
SET
  product_line_id = product.product_line_id,
  product_line_name = line.name
FROM product
LEFT JOIN product_line AS line
  ON line.id = product.product_line_id
WHERE product.id = item.product_id
  AND item.product_line_id IS NULL
  AND product.product_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pending_delivery_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(160) NOT NULL,
  customer_key VARCHAR(160) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  product_key VARCHAR(160) NOT NULL,
  unit_name VARCHAR(60) NOT NULL DEFAULT 'unidades',
  unit_key VARCHAR(60) NOT NULL DEFAULT 'unidades',
  total_purchased_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_delivered_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
  opened_on DATE NOT NULL,
  last_movement_on DATE NOT NULL,
  closed_on DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  notes TEXT NULL,
  created_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_delivery_account_status_check
    CHECK (status IN ('OPEN', 'COMPLETED')),
  CONSTRAINT pending_delivery_account_quantity_check
    CHECK (
      total_purchased_qty >= 0
      AND total_delivered_qty >= 0
      AND remaining_qty >= 0
      AND total_purchased_qty >= total_delivered_qty
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_delivery_open_unique
  ON pending_delivery_account (customer_key, product_key, unit_key)
  WHERE status = 'OPEN';

DROP TRIGGER IF EXISTS trg_pending_delivery_account_updated_at
  ON pending_delivery_account;

CREATE TRIGGER trg_pending_delivery_account_updated_at
BEFORE UPDATE ON pending_delivery_account
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS pending_delivery_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES pending_delivery_account(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  movement_on DATE NOT NULL,
  notes TEXT NULL,
  recorded_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_delivery_movement_type_check
    CHECK (movement_type IN ('PURCHASE', 'DELIVERY')),
  CONSTRAINT pending_delivery_movement_quantity_check
    CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS pending_delivery_account_status_idx
  ON pending_delivery_account (status, last_movement_on DESC);

CREATE INDEX IF NOT EXISTS pending_delivery_movement_account_idx
  ON pending_delivery_movement (account_id, movement_on DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS cement_calculator_brand_config (
  brand_key VARCHAR(30) PRIMARY KEY,
  mula_bags_qty NUMERIC(12, 2) NOT NULL DEFAULT 823,
  total_mula NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_coteros NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cement_calculator_brand_values_check
    CHECK (mula_bags_qty > 0 AND total_mula >= 0 AND total_coteros >= 0)
);

ALTER TABLE cement_calculator_brand_config
ADD COLUMN IF NOT EXISTS mula_bags_qty NUMERIC(12, 2) NOT NULL DEFAULT 823;

UPDATE cement_calculator_brand_config
SET mula_bags_qty = 823
WHERE mula_bags_qty IS NULL OR mula_bags_qty <= 0;

ALTER TABLE cement_calculator_brand_config
DROP CONSTRAINT IF EXISTS cement_calculator_brand_values_check;

ALTER TABLE cement_calculator_brand_config
ADD CONSTRAINT cement_calculator_brand_values_check
CHECK (mula_bags_qty > 0 AND total_mula >= 0 AND total_coteros >= 0);

DROP TRIGGER IF EXISTS trg_cement_calculator_brand_updated_at
  ON cement_calculator_brand_config;

CREATE TRIGGER trg_cement_calculator_brand_updated_at
BEFORE UPDATE ON cement_calculator_brand_config
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS cement_calculator_product_config (
  brand_key VARCHAR(30) NOT NULL,
  product_key VARCHAR(80) NOT NULL,
  sale_price_ref NUMERIC(14, 2) NULL,
  unit_weight_kg NUMERIC(10, 3) NULL,
  updated_by_user_id UUID NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brand_key, product_key),
  CONSTRAINT cement_calculator_product_values_check
    CHECK (
      (sale_price_ref IS NULL OR sale_price_ref >= 0)
      AND (unit_weight_kg IS NULL OR unit_weight_kg >= 0)
    )
);

ALTER TABLE cement_calculator_product_config
ADD COLUMN IF NOT EXISTS unit_weight_kg NUMERIC(10, 3) NULL;

DROP TRIGGER IF EXISTS trg_cement_calculator_product_updated_at
  ON cement_calculator_product_config;

CREATE TRIGGER trg_cement_calculator_product_updated_at
BEFORE UPDATE ON cement_calculator_product_config
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS integration.sync_state (
  source_system VARCHAR(40) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  last_successful_from DATE NULL,
  last_successful_to DATE NULL,
  last_successful_at TIMESTAMPTZ NULL,
  last_run_id UUID NULL,
  active_date_from DATE NULL,
  active_date_to DATE NULL,
  next_page INTEGER NOT NULL DEFAULT 1,
  backfill_complete BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_system, entity_type, branch_id),
  CONSTRAINT integration_sync_state_page_check
    CHECK (next_page > 0)
);

CREATE TABLE IF NOT EXISTS integration.sync_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'INCREMENTAL',
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  pages_processed INTEGER NOT NULL DEFAULT 0,
  source_rows INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  detail_rows INTEGER NOT NULL DEFAULT 0,
  window_complete BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT NULL,
  initiated_by_user_id UUID NULL REFERENCES public.app_user(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT integration_sync_run_mode_check
    CHECK (mode IN ('INITIAL', 'INCREMENTAL', 'MANUAL')),
  CONSTRAINT integration_sync_run_status_check
    CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  CONSTRAINT integration_sync_run_dates_check
    CHECK (date_to >= date_from),
  CONSTRAINT integration_sync_run_counts_check
    CHECK (
      pages_processed >= 0
      AND source_rows >= 0
      AND records_created >= 0
      AND records_updated >= 0
      AND records_skipped >= 0
      AND detail_rows >= 0
    )
);

CREATE INDEX IF NOT EXISTS integration_sync_run_started_idx
  ON integration.sync_run (started_at DESC);

CREATE INDEX IF NOT EXISTS integration_sync_run_entity_idx
  ON integration.sync_run (source_system, entity_type, branch_id, started_at DESC);

CREATE TABLE IF NOT EXISTS integration.source_record (
  source_system VARCHAR(40) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  document_number VARCHAR(120) NULL,
  source_date DATE NULL,
  payload JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  PRIMARY KEY (source_system, entity_type, branch_id, external_id)
);

CREATE INDEX IF NOT EXISTS integration_source_record_date_idx
  ON integration.source_record (entity_type, source_date DESC);

CREATE TABLE IF NOT EXISTS analytics.dim_date (
  date_key DATE PRIMARY KEY,
  year_number SMALLINT NOT NULL,
  quarter_number SMALLINT NOT NULL,
  month_number SMALLINT NOT NULL,
  day_number SMALLINT NOT NULL,
  iso_week_number SMALLINT NOT NULL,
  day_of_week_number SMALLINT NOT NULL,
  is_weekend BOOLEAN NOT NULL
);

INSERT INTO analytics.dim_date (
  date_key,
  year_number,
  quarter_number,
  month_number,
  day_number,
  iso_week_number,
  day_of_week_number,
  is_weekend
)
SELECT
  calendar_day::date,
  EXTRACT(YEAR FROM calendar_day)::smallint,
  EXTRACT(QUARTER FROM calendar_day)::smallint,
  EXTRACT(MONTH FROM calendar_day)::smallint,
  EXTRACT(DAY FROM calendar_day)::smallint,
  EXTRACT(WEEK FROM calendar_day)::smallint,
  EXTRACT(ISODOW FROM calendar_day)::smallint,
  EXTRACT(ISODOW FROM calendar_day) IN (6, 7)
FROM generate_series(
  DATE '2020-01-01',
  DATE '2035-12-31',
  INTERVAL '1 day'
) AS calendar_day
ON CONFLICT (date_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS analytics.dim_customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  customer_key VARCHAR(200) NOT NULL,
  external_id VARCHAR(160) NULL,
  local_customer_id UUID NULL REFERENCES public.customer(id),
  identification VARCHAR(80) NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(80) NULL,
  address TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, branch_id, customer_key)
);

CREATE INDEX IF NOT EXISTS analytics_dim_customer_external_idx
  ON analytics.dim_customer (source_system, branch_id, external_id);

CREATE TABLE IF NOT EXISTS analytics.dim_product (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  product_key VARCHAR(200) NOT NULL,
  external_id VARCHAR(160) NULL,
  local_product_id UUID NULL REFERENCES public.product(id),
  sku VARCHAR(120) NULL,
  name VARCHAR(240) NOT NULL,
  unit_name VARCHAR(80) NULL,
  category VARCHAR(120) NULL,
  product_line_id UUID NULL REFERENCES public.product_line(id),
  product_line_name VARCHAR(120) NULL,
  current_sale_price NUMERIC(16, 4) NULL,
  current_standard_cost NUMERIC(16, 4) NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, branch_id, product_key)
);

CREATE INDEX IF NOT EXISTS analytics_dim_product_external_idx
  ON analytics.dim_product (source_system, branch_id, external_id);

CREATE INDEX IF NOT EXISTS analytics_dim_product_name_idx
  ON analytics.dim_product (LOWER(name));

CREATE TABLE IF NOT EXISTS analytics.dim_supplier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  supplier_key VARCHAR(200) NOT NULL,
  external_id VARCHAR(160) NULL,
  identification VARCHAR(80) NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(80) NULL,
  address TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, branch_id, supplier_key)
);

CREATE INDEX IF NOT EXISTS analytics_dim_supplier_external_idx
  ON analytics.dim_supplier (source_system, branch_id, external_id);

CREATE TABLE IF NOT EXISTS analytics.fact_sale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  document_number VARCHAR(120) NULL,
  customer_id UUID NULL REFERENCES analytics.dim_customer(id),
  sale_on DATE NOT NULL REFERENCES analytics.dim_date(date_key),
  sale_time TIME NULL,
  status VARCHAR(80) NULL,
  payment_status VARCHAR(80) NULL,
  payment_method VARCHAR(120) NULL,
  gross_amount NUMERIC(18, 4) NULL,
  discount_amount NUMERIC(18, 4) NULL,
  return_amount NUMERIC(18, 4) NULL,
  tax_amount NUMERIC(18, 4) NULL,
  net_amount NUMERIC(18, 4) NULL,
  cost_amount NUMERIC(18, 4) NULL,
  gross_profit NUMERIC(18, 4) NULL,
  paid_amount NUMERIC(18, 4) NULL,
  balance_due NUMERIC(18, 4) NULL,
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  has_complete_cost BOOLEAN NOT NULL DEFAULT FALSE,
  source_updated_at TIMESTAMPTZ NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  UNIQUE (source_system, branch_id, external_id)
);

CREATE INDEX IF NOT EXISTS analytics_fact_sale_date_idx
  ON analytics.fact_sale (sale_on DESC, document_number);

CREATE INDEX IF NOT EXISTS analytics_fact_sale_customer_idx
  ON analytics.fact_sale (customer_id, sale_on DESC);

CREATE TABLE IF NOT EXISTS analytics.fact_sale_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES analytics.fact_sale(id) ON DELETE CASCADE,
  line_key VARCHAR(200) NOT NULL,
  external_line_id VARCHAR(160) NULL,
  line_number INTEGER NULL,
  product_id UUID NULL REFERENCES analytics.dim_product(id),
  local_product_id UUID NULL REFERENCES public.product(id),
  product_external_id VARCHAR(160) NULL,
  product_sku VARCHAR(120) NULL,
  product_name VARCHAR(240) NOT NULL,
  unit_name VARCHAR(80) NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4) NULL,
  gross_amount NUMERIC(18, 4) NULL,
  discount_amount NUMERIC(18, 4) NULL,
  tax_amount NUMERIC(18, 4) NULL,
  net_amount NUMERIC(18, 4) NULL,
  unit_cost NUMERIC(18, 4) NULL,
  cost_amount NUMERIC(18, 4) NULL,
  gross_profit NUMERIC(18, 4) NULL,
  margin_percent NUMERIC(12, 6) NULL,
  cost_status VARCHAR(30) NOT NULL DEFAULT 'MISSING',
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sale_id, line_key),
  CONSTRAINT analytics_fact_sale_item_quantity_check
    CHECK (quantity <> 0),
  CONSTRAINT analytics_fact_sale_item_cost_status_check
    CHECK (cost_status IN ('SOURCE', 'PRODUCT', 'PRODUCTION', 'MISSING'))
);

CREATE INDEX IF NOT EXISTS analytics_fact_sale_item_product_idx
  ON analytics.fact_sale_item (product_id, sale_id);

CREATE TABLE IF NOT EXISTS analytics.fact_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  document_number VARCHAR(120) NULL,
  payment_on DATE NOT NULL REFERENCES analytics.dim_date(date_key),
  payment_time TIME NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  status VARCHAR(80) NULL,
  payment_method VARCHAR(120) NULL,
  bank_name VARCHAR(160) NULL,
  counterparty_name VARCHAR(200) NULL,
  counterparty_external_id VARCHAR(160) NULL,
  related_document_type VARCHAR(80) NULL,
  related_document_id VARCHAR(160) NULL,
  related_document_number VARCHAR(120) NULL,
  amount NUMERIC(18, 4) NOT NULL,
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  source_updated_at TIMESTAMPTZ NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  UNIQUE (source_system, branch_id, external_id),
  CONSTRAINT analytics_fact_payment_direction_check
    CHECK (direction IN ('IN', 'OUT', 'UNKNOWN')),
  CONSTRAINT analytics_fact_payment_amount_check
    CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS analytics_fact_payment_date_idx
  ON analytics.fact_payment (payment_on DESC, direction);

CREATE TABLE IF NOT EXISTS analytics.fact_purchase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  document_number VARCHAR(120) NULL,
  supplier_id UUID NULL REFERENCES analytics.dim_supplier(id),
  purchase_on DATE NOT NULL REFERENCES analytics.dim_date(date_key),
  status VARCHAR(80) NULL,
  gross_amount NUMERIC(18, 4) NULL,
  discount_amount NUMERIC(18, 4) NULL,
  tax_amount NUMERIC(18, 4) NULL,
  net_amount NUMERIC(18, 4) NULL,
  paid_amount NUMERIC(18, 4) NULL,
  balance_due NUMERIC(18, 4) NULL,
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  source_updated_at TIMESTAMPTZ NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  UNIQUE (source_system, branch_id, external_id)
);

CREATE INDEX IF NOT EXISTS analytics_fact_purchase_date_idx
  ON analytics.fact_purchase (purchase_on DESC, document_number);

CREATE TABLE IF NOT EXISTS analytics.fact_purchase_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES analytics.fact_purchase(id) ON DELETE CASCADE,
  line_key VARCHAR(200) NOT NULL,
  external_line_id VARCHAR(160) NULL,
  line_number INTEGER NULL,
  product_id UUID NULL REFERENCES analytics.dim_product(id),
  local_product_id UUID NULL REFERENCES public.product(id),
  product_external_id VARCHAR(160) NULL,
  product_sku VARCHAR(120) NULL,
  product_name VARCHAR(240) NOT NULL,
  unit_name VARCHAR(80) NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_cost NUMERIC(18, 4) NULL,
  gross_amount NUMERIC(18, 4) NULL,
  discount_amount NUMERIC(18, 4) NULL,
  tax_amount NUMERIC(18, 4) NULL,
  net_amount NUMERIC(18, 4) NULL,
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_id, line_key),
  CONSTRAINT analytics_fact_purchase_item_quantity_check
    CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS analytics_fact_purchase_item_product_idx
  ON analytics.fact_purchase_item (product_id, purchase_id);

CREATE TABLE IF NOT EXISTS analytics.fact_inventory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(40) NOT NULL,
  branch_id VARCHAR(80) NOT NULL,
  snapshot_on DATE NOT NULL REFERENCES analytics.dim_date(date_key),
  product_id UUID NOT NULL REFERENCES analytics.dim_product(id),
  local_product_id UUID NULL REFERENCES public.product(id),
  quantity NUMERIC(18, 4) NOT NULL,
  unit_cost NUMERIC(18, 4) NULL,
  inventory_value NUMERIC(18, 4) NULL,
  source_synced_at TIMESTAMPTZ NULL,
  last_sync_run_id UUID NULL REFERENCES integration.sync_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, branch_id, snapshot_on, product_id)
);

CREATE INDEX IF NOT EXISTS analytics_fact_inventory_snapshot_date_idx
  ON analytics.fact_inventory_snapshot (snapshot_on DESC, product_id);

CREATE OR REPLACE VIEW analytics.operating_expenses AS
SELECT
  'APP_EXPENSE'::varchar(40) AS source_system,
  expense.id::text AS external_id,
  expense.expense_on,
  expense.category,
  expense.concept,
  expense.provider_name,
  expense.total_amount,
  expense.is_voided,
  expense.created_at,
  expense.updated_at
FROM public.operating_expense AS expense
UNION ALL
SELECT
  'APP_TRANSPORT'::varchar(40) AS source_system,
  transport.id::text AS external_id,
  transport.cost_on AS expense_on,
  'TRANSPORT'::varchar(30) AS category,
  transport.concept,
  transport.provider_name,
  transport.total_cost AS total_amount,
  transport.is_voided,
  transport.created_at,
  transport.updated_at
FROM public.transport_cost AS transport;

CREATE OR REPLACE VIEW analytics.daily_sales AS
SELECT
  sale.sale_on,
  COUNT(*) FILTER (WHERE sale.is_voided = FALSE) AS transaction_count,
  COALESCE(SUM(sale.gross_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS gross_amount,
  COALESCE(SUM(sale.return_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS return_amount,
  COALESCE(SUM(sale.tax_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS tax_amount,
  COALESCE(SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS net_amount,
  COALESCE(SUM(sale.cost_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS cost_amount,
  COALESCE(SUM(sale.gross_profit) FILTER (WHERE sale.is_voided = FALSE), 0) AS gross_profit,
  CASE
    WHEN COALESCE(SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE), 0) = 0
      THEN NULL
    ELSE
      COALESCE(SUM(sale.gross_profit) FILTER (WHERE sale.is_voided = FALSE), 0)
      / SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE)
  END AS margin_percent
FROM analytics.fact_sale AS sale
GROUP BY sale.sale_on;

CREATE OR REPLACE VIEW analytics.product_performance AS
SELECT
  product.id AS product_id,
  product.external_id,
  product.sku,
  product.name,
  product.category,
  product.product_line_name,
  COUNT(DISTINCT sale.id) FILTER (WHERE sale.is_voided = FALSE) AS transaction_count,
  COALESCE(SUM(item.quantity) FILTER (WHERE sale.is_voided = FALSE), 0) AS quantity_sold,
  COALESCE(SUM(item.net_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS net_amount,
  COALESCE(SUM(item.cost_amount) FILTER (WHERE sale.is_voided = FALSE), 0) AS cost_amount,
  COALESCE(SUM(item.gross_profit) FILTER (WHERE sale.is_voided = FALSE), 0) AS gross_profit,
  CASE
    WHEN COALESCE(SUM(item.net_amount) FILTER (WHERE sale.is_voided = FALSE), 0) = 0
      THEN NULL
    ELSE
      COALESCE(SUM(item.gross_profit) FILTER (WHERE sale.is_voided = FALSE), 0)
      / SUM(item.net_amount) FILTER (WHERE sale.is_voided = FALSE)
  END AS margin_percent,
  COUNT(*) FILTER (
    WHERE sale.is_voided = FALSE
      AND item.cost_status = 'MISSING'
  ) AS lines_without_cost
FROM analytics.dim_product AS product
LEFT JOIN analytics.fact_sale_item AS item
  ON item.product_id = product.id
LEFT JOIN analytics.fact_sale AS sale
  ON sale.id = item.sale_id
GROUP BY
  product.id,
  product.external_id,
  product.sku,
  product.name,
  product.category,
  product.product_line_name;

CREATE OR REPLACE VIEW analytics.monthly_sales AS
SELECT
  DATE_TRUNC('month', sale_on)::date AS month_on,
  SUM(transaction_count) AS transaction_count,
  SUM(gross_amount) AS gross_amount,
  SUM(return_amount) AS return_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(net_amount) AS net_amount,
  SUM(cost_amount) AS cost_amount,
  SUM(gross_profit) AS gross_profit,
  CASE
    WHEN SUM(net_amount) = 0 THEN NULL
    ELSE SUM(gross_profit) / SUM(net_amount)
  END AS margin_percent
FROM analytics.daily_sales
GROUP BY DATE_TRUNC('month', sale_on)::date;
