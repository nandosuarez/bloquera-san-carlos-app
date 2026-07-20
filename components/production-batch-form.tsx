"use client";

import { useState } from "react";

type BlockOption = {
  dimensionLabel: string | null;
  id: string;
  laborUnitCost: number;
  name: string;
};

type CollaboratorOption = {
  fullName: string;
  id: string;
};

type InputOption = {
  id: string;
  name: string;
  standardCost: number;
  unitName: string;
};

type ProductionBatchFormProps = {
  blocks: BlockOption[];
  cements: InputOption[];
  collaborators: CollaboratorOption[];
  defaultDate: string;
  sands: InputOption[];
};

export function ProductionBatchForm({
  blocks,
  cements,
  collaborators,
  defaultDate,
  sands
}: ProductionBatchFormProps) {
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [laborUnitCost, setLaborUnitCost] = useState("");

  function handleBlockChange(nextBlockId: string) {
    setSelectedBlockId(nextBlockId);
    const block = blocks.find((item) => item.id === nextBlockId);
    setLaborUnitCost(
      block && block.laborUnitCost > 0 ? formatInputNumber(block.laborUnitCost) : ""
    );
  }

  return (
    <form action="/api/production/batches" className="stack-form" method="post">
      <div className="split-fields">
        <label className="field">
          <span>Bloque</span>
          <select
            name="blockProductId"
            onChange={(event) => handleBlockChange(event.target.value)}
            required
            value={selectedBlockId}
          >
            <option value="">Seleccionar</option>
            {blocks.map((block) => (
              <option key={block.id} value={block.id}>
                {block.name}
                {block.dimensionLabel ? ` - ${block.dimensionLabel}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Colaborador</span>
          <select defaultValue="" name="collaboratorId" required>
            <option value="">Seleccionar</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split-fields three-fields">
        <label className="field">
          <span>Fecha</span>
          <input defaultValue={defaultDate} name="productionOn" required type="date" />
        </label>
        <label className="field">
          <span>Bloques hechos</span>
          <input min="0.01" name="producedQty" required step="0.01" type="number" />
        </label>
        <label className="field">
          <span>Mano de obra por bloque</span>
          <input
            min="0"
            name="laborUnitCost"
            onChange={(event) => setLaborUnitCost(event.target.value)}
            step="0.01"
            type="number"
            value={laborUnitCost}
          />
        </label>
      </div>

      <div className="split-fields">
        <label className="field">
          <span>Cemento</span>
          <select defaultValue="" name="cementProductId" required>
            <option value="">Seleccionar</option>
            {cements.map((cement) => (
              <option key={cement.id} value={cement.id}>
                {cement.name} ({cement.unitName}) - {formatMoney(cement.standardCost)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Arena</span>
          <select defaultValue="" name="sandProductId" required>
            <option value="">Seleccionar</option>
            {sands.map((sand) => (
              <option key={sand.id} value={sand.id}>
                {sand.name} ({sand.unitName}) - {formatMoney(sand.standardCost)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cements.length === 0 || sands.length === 0 ? (
        <div className="message message-error">
          Debes registrar insumos por categoria (cemento y arena) en el modulo Insumos.
        </div>
      ) : null}

      <div className="split-fields">
        <label className="field">
          <span>Bolsas de cemento usadas</span>
          <input min="0.01" name="cementUsedQty" required step="0.01" type="number" />
        </label>
        <label className="field">
          <span>Latas de arena usadas</span>
          <input min="0.01" name="sandUsedQty" required step="0.01" type="number" />
        </label>
      </div>

      <label className="field">
        <span>Nota</span>
        <textarea name="notes" rows={2} />
      </label>

      <button className="primary-button" type="submit">
        Guardar produccion
      </button>
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

function formatInputNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}
