"use client";

import { useEffect, useState } from "react";
import { CustomerSearchSelect } from "@/components/customer-search-select";
import type {
  DeliveryCollaboratorOption,
  DeliveryCustomerOption,
  DeliveryProductOption,
  DeliveryVehicleOption
} from "@/lib/delivery-services";

type DeliveryProductRow = {
  id: number;
  productId: string;
  quantity: string;
  tripCount: string;
};

type DeliveryServiceFormProps = {
  collaborators: DeliveryCollaboratorOption[];
  customers: DeliveryCustomerOption[];
  defaultDate: string;
  products: DeliveryProductOption[];
  vehicles: DeliveryVehicleOption[];
};

export function DeliveryServiceForm({
  collaborators,
  customers,
  defaultDate,
  products,
  vehicles
}: DeliveryServiceFormProps) {
  const [customerId, setCustomerId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [productRows, setProductRows] = useState<DeliveryProductRow[]>([
    { id: 1, productId: "", quantity: "", tripCount: "1" }
  ]);

  const hasBaseData =
    collaborators.length > 0 &&
    customers.length > 0 &&
    vehicles.length > 0 &&
    products.length > 0;

  useEffect(() => {
    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    if (!selectedCustomer) {
      setCustomerPhone("");
      setCustomerAddress("");
      return;
    }

    setCustomerPhone(selectedCustomer.phone ?? "");
    setCustomerAddress(selectedCustomer.address ?? "");
  }, [customerId, customers]);

  function addProductRow() {
    setProductRows((currentRows) => {
      const nextId = currentRows.length === 0 ? 1 : Math.max(...currentRows.map((row) => row.id)) + 1;
      return [...currentRows, { id: nextId, productId: "", quantity: "", tripCount: "1" }];
    });
  }

  function removeProductRow(rowId: number) {
    setProductRows((currentRows) => {
      if (currentRows.length <= 1) return currentRows;
      return currentRows.filter((row) => row.id !== rowId);
    });
  }

  function updateProductRow(
    rowId: number,
    field: "productId" | "quantity" | "tripCount",
    value: string
  ) {
    setProductRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  }

  return (
    <form action="/api/domicilios" className="stack-form" method="post">
      <div className="split-fields">
        <label className="field">
          <span>Fecha</span>
          <input defaultValue={defaultDate} name="serviceOn" required type="date" />
        </label>

        <label className="field">
          <span>Colaborador</span>
          <select defaultValue="" disabled={collaborators.length === 0} name="collaboratorId" required>
            <option value="">Seleccionar</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split-fields">
        <CustomerSearchSelect
          customers={customers}
          disabled={customers.length === 0}
          onChange={setCustomerId}
          required
          value={customerId}
        />
        <label className="field">
          <span>Telefono</span>
          <input
            name="customerPhone"
            onChange={(event) => setCustomerPhone(event.target.value)}
            required
            type="text"
            value={customerPhone}
          />
        </label>
      </div>

      <label className="field">
        <span>Direccion</span>
        <input
          name="customerAddress"
          onChange={(event) => setCustomerAddress(event.target.value)}
          required
          type="text"
          value={customerAddress}
        />
      </label>

      <div className="split-fields three-fields">
        <label className="field">
          <span>Carro</span>
          <select
            disabled={vehicles.length === 0}
            name="vehicleId"
            onChange={(event) => setVehicleId(event.target.value)}
            required
            value={vehicleId}
          >
            <option value="">Seleccionar</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate ? `${vehicle.label} - ${vehicle.plate}` : vehicle.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-headline">
        <strong>Productos</strong>
        <button className="ghost-button" onClick={addProductRow} type="button">
          Agregar otro
        </button>
      </div>

      <div className="stack-form">
        {productRows.map((row, index) => (
          <div className="delivery-product-row" key={row.id}>
            <label className="field">
              <span>Producto {index + 1}</span>
              <select
                disabled={products.length === 0}
                name="productId"
                onChange={(event) => updateProductRow(row.id, "productId", event.target.value)}
                value={row.productId}
              >
                <option value="">Seleccionar</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="split-fields three-fields">
              <label className="field">
                <span>Cantidad</span>
                <input
                  min="0.01"
                  name="quantity"
                  onChange={(event) => updateProductRow(row.id, "quantity", event.target.value)}
                  step="0.01"
                  type="number"
                  value={row.quantity}
                />
              </label>
              <label className="field">
                <span>Viajes</span>
                <input
                  min="1"
                  name="tripCount"
                  onChange={(event) => updateProductRow(row.id, "tripCount", event.target.value)}
                  step="1"
                  type="number"
                  value={row.tripCount}
                />
              </label>
              <label className="field">
                <span>Accion</span>
                <button
                  className="ghost-button"
                  disabled={productRows.length <= 1}
                  onClick={() => removeProductRow(row.id)}
                  type="button"
                >
                  Quitar
                </button>
              </label>
            </div>
            <TripSuggestion
              products={products}
              row={row}
              setTripCount={(value) => updateProductRow(row.id, "tripCount", value)}
              vehicle={vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null}
            />
          </div>
        ))}
      </div>

      <label className="field">
        <span>Nota</span>
        <textarea name="notes" rows={2} />
      </label>

      {!hasBaseData ? (
        <div className="message message-error">
          Necesitas colaboradores, clientes, carros y productos activos para registrar domicilios.
        </div>
      ) : null}

      <button className="primary-button" disabled={!hasBaseData} type="submit">
        {hasBaseData ? "Guardar domicilio" : "Completa administracion primero"}
      </button>
    </form>
  );
}

function TripSuggestion({
  products,
  row,
  setTripCount,
  vehicle
}: {
  products: DeliveryProductOption[];
  row: DeliveryProductRow;
  setTripCount: (value: string) => void;
  vehicle: DeliveryVehicleOption | null;
}) {
  const product = products.find((item) => item.id === row.productId) ?? null;
  const quantity = Number(row.quantity.replace(",", "."));
  const totalWeight =
    product && Number.isFinite(quantity) && quantity > 0
      ? product.weightKg * quantity
      : 0;
  const suggestedTrips =
    vehicle && vehicle.maxLoadKg > 0 && totalWeight > 0
      ? Math.max(1, Math.ceil(totalWeight / vehicle.maxLoadKg))
      : null;

  if (!product || !vehicle || product.weightKg <= 0 || vehicle.maxLoadKg <= 0 || !suggestedTrips) {
    return (
      <div className="delivery-trip-hint">
        Configura peso del producto y capacidad del carro para sugerir viajes.
      </div>
    );
  }

  return (
    <div className="delivery-trip-hint delivery-trip-hint-ready">
      <span>
        Peso estimado: {formatQuantity(totalWeight)} kg. Viajes sugeridos:{" "}
        <strong>{suggestedTrips}</strong>.
      </span>
      <button className="ghost-button" onClick={() => setTripCount(String(suggestedTrips))} type="button">
        Aplicar
      </button>
    </div>
  );
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}
