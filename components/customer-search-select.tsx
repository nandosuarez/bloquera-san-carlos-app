"use client";

import { useEffect, useId, useState } from "react";

type CustomerOption = {
  address?: string | null;
  id: string;
  name: string;
  phone?: string | null;
};

type CustomerSearchSelectProps = {
  customers: CustomerOption[];
  defaultValue?: string | null;
  disabled?: boolean;
  helperText?: string;
  label?: string;
  name?: string;
  onChange?: (customerId: string) => void;
  placeholder?: string;
  required?: boolean;
  value?: string;
};

const MAX_RESULTS = 24;

export function CustomerSearchSelect({
  customers,
  defaultValue = "",
  disabled = false,
  helperText = "Escribe el nombre o telefono y selecciona el cliente.",
  label = "Cliente",
  name = "customerId",
  onChange,
  placeholder = "Buscar cliente",
  required = false,
  value
}: CustomerSearchSelectProps) {
  const inputId = useId();
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedId = isControlled ? value : internalValue;
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedId) ?? null;
  const selectedLabel = selectedCustomer ? buildCustomerLabel(selectedCustomer) : "";
  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const filteredCustomers = filterCustomers(customers, query);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  function updateSelectedCustomer(nextCustomerId: string) {
    if (!isControlled) {
      setInternalValue(nextCustomerId);
    }

    onChange?.(nextCustomerId);
  }

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setIsOpen(true);

    if (selectedId && normalizeText(nextQuery) !== normalizeText(selectedLabel)) {
      updateSelectedCustomer("");
    }
  }

  function selectCustomer(customer: CustomerOption) {
    updateSelectedCustomer(customer.id);
    setQuery(buildCustomerLabel(customer));
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
          placeholder={disabled ? "Sin clientes activos" : placeholder}
          required={required}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Limpiar cliente"
            className="search-select-clear"
            disabled={disabled}
            onClick={() => {
              updateSelectedCustomer("");
              setQuery("");
              setIsOpen(true);
            }}
            type="button"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <input name={name} type="hidden" value={selectedId} />

      {isOpen && !disabled ? (
        <div className="search-select-results" id={`${inputId}-results`} role="listbox">
          {filteredCustomers.length === 0 ? (
            <div className="search-select-empty">No encontre clientes con esa busqueda.</div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                className="search-select-option"
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                <strong>{customer.name}</strong>
                {customer.phone ? <span>{customer.phone}</span> : null}
                {customer.address ? <small>{customer.address}</small> : null}
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedCustomer ? (
        <small className="search-select-selected">
          Seleccionado: <strong>{selectedCustomer.name}</strong>
          {selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ""}
        </small>
      ) : (
        <small className="search-select-help">{helperText}</small>
      )}
    </div>
  );
}

function filterCustomers(customers: CustomerOption[], query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return customers.slice(0, MAX_RESULTS);
  }

  return customers
    .filter((customer) => {
      const searchableText = normalizeText(
        `${customer.name} ${customer.phone ?? ""} ${customer.address ?? ""}`
      );
      return searchableText.includes(normalizedQuery);
    })
    .slice(0, MAX_RESULTS);
}

function buildCustomerLabel(customer: CustomerOption) {
  return customer.phone ? `${customer.name} - ${customer.phone}` : customer.name;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}
