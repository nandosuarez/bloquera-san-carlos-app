"use client";

import { useEffect } from "react";
import { tryRecoverClient } from "@/lib/client-error-recovery";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    tryRecoverClient(error);
  }, [error]);

  return (
    <main className="app-error-screen">
      <section className="app-error-card">
        <span className="app-error-mark">BSC</span>
        <p className="app-error-eyebrow">Conexion recuperada</p>
        <h1>No pudimos mostrar esta pantalla</h1>
        <p>
          La aplicacion intento actualizar sus archivos automaticamente. Si el
          problema continua, vuelve a intentar o regresa al inicio.
        </p>
        <div className="form-actions">
          <button className="primary-button" onClick={reset} type="button">
            Intentar de nuevo
          </button>
          <a className="ghost-button" href="/inicio">
            Ir al inicio
          </a>
        </div>
        {error.digest ? (
          <small className="table-muted">Referencia: {error.digest}</small>
        ) : null}
      </section>
    </main>
  );
}
