"use client";

import { useEffect, useState } from "react";
import {
  forceReloadClient,
  isRecoverableClientError,
  tryRecoverClient
} from "@/lib/client-error-recovery";

export default function AppError({
  error
}: {
  error: Error & { digest?: string };
}) {
  const isRecoverable = isRecoverableClientError(error);
  const [recoveryFailed, setRecoveryFailed] = useState(!isRecoverable);

  useEffect(() => {
    if (!isRecoverable || !tryRecoverClient(error)) {
      setRecoveryFailed(true);
    }
  }, [error, isRecoverable]);

  return (
    <main className="app-error-screen">
      <section aria-live="polite" className="app-error-card">
        <span className="app-error-mark">BSC</span>
        {recoveryFailed ? (
          <>
            <p className="app-error-eyebrow">Necesitamos recargar</p>
            <h1>No pudimos mostrar esta pantalla</h1>
            <p>
              Presiona el boton para descargar la version mas reciente de la
              aplicacion.
            </p>
            <div className="form-actions">
              <button
                className="primary-button"
                onClick={forceReloadClient}
                type="button"
              >
                Recargar aplicacion
              </button>
              <a className="ghost-button" href="/inicio">
                Ir al inicio
              </a>
            </div>
            {error.digest ? (
              <small className="table-muted">
                Referencia: {error.digest}
              </small>
            ) : null}
          </>
        ) : (
          <>
            <p className="app-error-eyebrow">Nueva version disponible</p>
            <h1>Actualizando la aplicacion</h1>
            <p>
              Estamos cargando los archivos mas recientes. Esta pantalla se
              cerrara automaticamente.
            </p>
            <span aria-hidden="true" className="app-recovery-loader" />
          </>
        )}
      </section>
    </main>
  );
}
