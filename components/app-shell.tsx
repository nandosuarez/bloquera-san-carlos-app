"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

const navItems = [
  { href: "/inicio", label: "Inicio", short: "IN" },
  { href: "/domicilios", label: "Domicilios", short: "DM" },
  { href: "/costos-transporte", label: "Transporte", short: "TR" },
  { href: "/gastos", label: "Gastos", short: "GT" },
  { href: "/cierre-diario", label: "Cierre diario", short: "CD" },
  { href: "/analisis", label: "Analisis", short: "AN" },
  { href: "/reportes", label: "Reportes", short: "RP" },
  { href: "/pendientes-entrega", label: "Pendientes", short: "PE" },
  { href: "/calculadora-cemento", label: "Calculadora", short: "CC" },
  { href: "/produccion-bloques", label: "Bloques", short: "BL" },
  { href: "/administracion", label: "Administracion", short: "AD" }
];

type AppShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  eyebrow?: string;
  title: string;
};

export function AppShell({
  actions,
  children,
  compact = false,
  eyebrow,
  title
}: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? "";
  const searchKey = searchParams.toString();
  const adminSection = normalizeAdminSection(searchParams.get("section"));
  const domiciliosSection = normalizeDomiciliosSection(searchParams.get("section"));
  const isOnDomicilios = currentPath.startsWith("/domicilios");
  const isOnBlocksGroup =
    currentPath.startsWith("/produccion-bloques") ||
    currentPath.startsWith("/insumos") ||
    currentPath.startsWith("/inventario") ||
    currentPath.startsWith("/pagos-bloques");
  const isOnAdmin = currentPath.startsWith("/administracion");
  const [isDomiciliosSubnavOpen, setIsDomiciliosSubnavOpen] = useState(true);
  const [isBlocksSubnavOpen, setIsBlocksSubnavOpen] = useState(true);
  const [isAdminSubnavOpen, setIsAdminSubnavOpen] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isOnDomicilios) {
      setIsDomiciliosSubnavOpen(true);
    }
    if (!isOnBlocksGroup) {
      setIsBlocksSubnavOpen(true);
    }
    if (!isOnAdmin) {
      setIsAdminSubnavOpen(true);
    }
  }, [isOnAdmin, isOnBlocksGroup, isOnDomicilios]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [currentPath, searchKey]);

  function handleDomiciliosClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isOnDomicilios) return;
    event.preventDefault();
    setIsDomiciliosSubnavOpen((previous) => !previous);
  }

  function handleBlocksClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isOnBlocksGroup) return;
    event.preventDefault();
    setIsBlocksSubnavOpen((previous) => !previous);
  }

  function handleAdminClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isOnAdmin) return;
    event.preventDefault();
    setIsAdminSubnavOpen((previous) => !previous);
  }

  return (
    <div className="workspace-shell">
      <aside className={`workspace-sidebar ${isMobileNavOpen ? "workspace-sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-identity">
            <BrandLogo compact />
            <div>
              <strong>Bloquera</strong>
              <span>San Carlos</span>
            </div>
          </div>
          <button
            aria-controls="workspace-navigation"
            aria-expanded={isMobileNavOpen}
            className="mobile-menu-button"
            onClick={() => setIsMobileNavOpen((previous) => !previous)}
            type="button"
          >
            {isMobileNavOpen ? "Cerrar" : "Menu"}
          </button>
        </div>

        <nav className="sidebar-nav" id="workspace-navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/produccion-bloques"
                ? isOnBlocksGroup
                : currentPath === item.href ||
                  (item.href !== "/inicio" && currentPath.startsWith(item.href));

            return (
              <div key={item.href}>
                <Link
                  className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                  href={
                    item.href === "/domicilios"
                      ? `/domicilios?section=${domiciliosSection}`
                      : item.href === "/administracion"
                      ? `/administracion?section=${adminSection}`
                      : item.href
                  }
                  onClick={
                    item.href === "/domicilios"
                      ? handleDomiciliosClick
                      : item.href === "/administracion"
                      ? handleAdminClick
                      : item.href === "/produccion-bloques"
                        ? handleBlocksClick
                        : undefined
                  }
                >
                  <span className="sidebar-badge">{item.short}</span>
                  <span>{item.label}</span>
                </Link>

                {item.href === "/domicilios" && isOnDomicilios && isDomiciliosSubnavOpen ? (
                  <div className="sidebar-subnav">
                    <Link
                      className={`sidebar-subnav-link ${
                        domiciliosSection === "programar" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/domicilios?section=programar"
                    >
                      Programar
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        domiciliosSection === "servicios" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/domicilios?section=servicios"
                    >
                      Servicios
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        domiciliosSection === "productos" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/domicilios?section=productos"
                    >
                      Productos enviados
                    </Link>
                  </div>
                ) : null}

                {item.href === "/produccion-bloques" &&
                isOnBlocksGroup &&
                isBlocksSubnavOpen ? (
                  <div className="sidebar-subnav">
                    <Link
                      className={`sidebar-subnav-link ${
                        currentPath.startsWith("/produccion-bloques")
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/produccion-bloques"
                    >
                      Produccion
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        currentPath.startsWith("/insumos")
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/insumos"
                    >
                      Insumos
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        currentPath.startsWith("/inventario")
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/inventario"
                    >
                      Inventario
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        currentPath.startsWith("/pagos-bloques")
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/pagos-bloques"
                    >
                      Pagos
                    </Link>
                  </div>
                ) : null}

                {item.href === "/administracion" &&
                isOnAdmin &&
                isAdminSubnavOpen ? (
                  <div className="sidebar-subnav">
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "customers" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=customers"
                    >
                      Clientes
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "collaborators"
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/administracion?section=collaborators"
                    >
                      Colaboradores
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "products" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=products"
                    >
                      Productos
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "product-lines"
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/administracion?section=product-lines"
                    >
                      Lineas
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "users" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=users"
                    >
                      Usuarios
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "formulas" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=formulas"
                    >
                      Formulas
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "vehicles" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=vehicles"
                    >
                      Carros
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "transport-providers"
                          ? "sidebar-subnav-link-active"
                          : ""
                      }`}
                      href="/administracion?section=transport-providers"
                    >
                      Proveedores
                    </Link>
                    <Link
                      className={`sidebar-subnav-link ${
                        adminSection === "cuenti" ? "sidebar-subnav-link-active" : ""
                      }`}
                      href="/administracion?section=cuenti"
                    >
                      Cuenti
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className={`workspace-main ${compact ? "workspace-main-compact" : ""}`}>
        <header className={`workspace-topbar ${compact ? "workspace-topbar-compact" : ""}`}>
          <div className="workspace-title">
            {eyebrow ? <span className="topbar-eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
          </div>

          <div className="workspace-actions">{actions}</div>
        </header>

        <section className="workspace-content">{children}</section>
      </div>
    </div>
  );
}

function normalizeAdminSection(value: string | null) {
  if (value === "customers") return "customers";
  if (value === "collaborators") return "collaborators";
  if (value === "products") return "products";
  if (value === "product-lines") return "product-lines";
  if (value === "users") return "users";
  if (value === "formulas") return "formulas";
  if (value === "vehicles") return "vehicles";
  if (value === "transport-providers") return "transport-providers";
  if (value === "cuenti") return "cuenti";
  return "customers";
}

function normalizeDomiciliosSection(value: string | null) {
  if (value === "servicios") return "servicios";
  if (value === "productos") return "productos";
  return "programar";
}
