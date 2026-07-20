"use client";

import { useMemo, useState } from "react";

type OpenLaborCharge = {
  amountDue: number;
  chargeOn: string;
  collaboratorName: string;
  id: string;
  producedQty: number;
  unitRate: number;
};

type LaborPaymentsBulkFormProps = {
  charges: OpenLaborCharge[];
  defaultDate: string;
};

export function LaborPaymentsBulkForm({
  charges,
  defaultDate
}: LaborPaymentsBulkFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedTotal = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return charges.reduce((sum, charge) => {
      if (!selectedSet.has(charge.id)) return sum;
      return sum + charge.amountDue;
    }, 0);
  }, [charges, selectedIds]);

  const allSelected = charges.length > 0 && selectedIds.length === charges.length;

  function handleSelect(chargeId: string, checked: boolean) {
    setSelectedIds((previous) => {
      if (checked) {
        if (previous.includes(chargeId)) return previous;
        return [...previous, chargeId];
      }

      return previous.filter((id) => id !== chargeId);
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(charges.map((charge) => charge.id));
      return;
    }
    setSelectedIds([]);
  }

  return (
    <form action="/api/production/labor-charges/pay" className="stack-form" method="post">
      <div className="split-fields">
        <label className="field">
          <span>Fecha de pago</span>
          <input defaultValue={defaultDate} name="paidOn" required type="date" />
        </label>

        <label className="field">
          <span>Nota de pago (opcional)</span>
          <input name="paymentNotes" placeholder="Observacion del pago" type="text" />
        </label>
      </div>

      <div className="split-fields">
        <label className="field">
          <span>Total seleccionado para pagar</span>
          <input readOnly type="text" value={formatMoney(selectedTotal)} />
        </label>

        <div className="field">
          <span>Accion</span>
          <button className="primary-button" disabled={selectedIds.length === 0} type="submit">
            Pagar seleccionados
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={(event) => handleSelectAll(event.target.checked)}
                  type="checkbox"
                />
              </th>
              <th>Fecha cobro</th>
              <th>Colaborador</th>
              <th>Bloques</th>
              <th>Tarifa</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={6}>No hay cuentas pendientes.</td>
              </tr>
            ) : (
              charges.map((charge) => (
                <tr key={charge.id}>
                  <td>
                    <input
                      checked={selectedIds.includes(charge.id)}
                      name="chargeIds"
                      onChange={(event) =>
                        handleSelect(charge.id, event.target.checked)
                      }
                      type="checkbox"
                      value={charge.id}
                    />
                  </td>
                  <td>{formatDate(charge.chargeOn)}</td>
                  <td>{charge.collaboratorName}</td>
                  <td>{formatQuantity(charge.producedQty)}</td>
                  <td>{formatMoney(charge.unitRate)}</td>
                  <td>{formatMoney(charge.amountDue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatDate(dateValue: string) {
  const normalized = dateValue.slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}
