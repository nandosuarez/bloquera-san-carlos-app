"use client";

import { useEffect, useId, useState } from "react";

type ProductOption = {
  cuentiProductId?: string | null;
  id: string;
  name: string;
  sku?: string | null;
  unitName?: string | null;
};

type ProductSearchSelectProps = {
  disabled?: boolean;
  label?: string;
  name?: string;
  onChange?: (productId: string) => void;
  products: ProductOption[];
  value: string;
};

const MAX_RESULTS = 24;

export function ProductSearchSelect({
  disabled = false,
  label = "Producto",
  name = "productId",
  onChange,
  products,
  value
}: ProductSearchSelectProps) {
  const inputId = useId();
  const selectedProduct =
    products.find((product) => product.id === value) ?? null;
  const selectedLabel = selectedProduct
    ? buildProductLabel(selectedProduct)
    : "";
  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const filteredProducts = filterProducts(products, query);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setIsOpen(true);

    if (value && normalizeText(nextQuery) !== normalizeText(selectedLabel)) {
      onChange?.("");
    }
  }

  function selectProduct(product: ProductOption) {
    onChange?.(product.id);
    setQuery(buildProductLabel(product));
    setIsOpen(false);
  }

  return (
    <div className="field search-select">
      <span>{label}</span>
      <div className="search-select-control">
        <input
          aria-autocomplete="list"
          aria-controls={`${inputId}-results`}
          aria-expanded={isOpen}
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={disabled ? "Sin productos activos" : "Buscar producto"}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label={`Limpiar ${label.toLocaleLowerCase("es-CO")}`}
            className="search-select-clear"
            disabled={disabled}
            onClick={() => {
              onChange?.("");
              setQuery("");
              setIsOpen(true);
            }}
            type="button"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <input name={name} type="hidden" value={value} />

      {isOpen && !disabled ? (
        <div
          className="search-select-results"
          id={`${inputId}-results`}
          role="listbox"
        >
          {filteredProducts.length === 0 ? (
            <div className="search-select-empty">
              No encontre productos con esa busqueda.
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button
                className="search-select-option"
                key={product.id}
                onClick={() => selectProduct(product)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                <strong>{product.name}</strong>
                {product.sku ? <span>Referencia: {product.sku}</span> : null}
                <small>{product.unitName ?? "unidades"}</small>
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedProduct ? (
        <small className="search-select-selected">
          Seleccionado: <strong>{selectedProduct.name}</strong>
          {selectedProduct.sku ? ` - ${selectedProduct.sku}` : ""}
        </small>
      ) : (
        <small className="search-select-help">
          Escribe el nombre o referencia y selecciona el producto.
        </small>
      )}
    </div>
  );
}

function filterProducts(products: ProductOption[], query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return products.slice(0, MAX_RESULTS);
  }

  return products
    .filter((product) =>
      normalizeText(
        `${product.name} ${product.sku ?? ""} ${product.cuentiProductId ?? ""} ${product.unitName ?? ""}`
      ).includes(normalizedQuery)
    )
    .slice(0, MAX_RESULTS);
}

function buildProductLabel(product: ProductOption) {
  return product.sku ? `${product.name} - ${product.sku}` : product.name;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}
