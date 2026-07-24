"use client";

import { useEffect, useState } from "react";
import {
  forceReloadClient,
  tryRecoverClient
} from "@/lib/client-error-recovery";

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  const [recoveryFailed, setRecoveryFailed] = useState(false);

  useEffect(() => {
    if (!tryRecoverClient(error)) {
      setRecoveryFailed(true);
    }
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="app-error-screen">
          <section aria-live="polite" className="app-error-card">
            <span className="app-error-mark">BSC</span>
            {recoveryFailed ? (
              <>
                <p className="app-error-eyebrow">Necesitamos recargar</p>
                <h1>No pudimos iniciar la aplicacion</h1>
                <p>
                  Presiona el boton para descargar la version mas reciente.
                </p>
                <button
                  className="primary-button"
                  onClick={forceReloadClient}
                  type="button"
                >
                  Recargar aplicacion
                </button>
              </>
            ) : (
              <>
                <p className="app-error-eyebrow">
                  Nueva version disponible
                </p>
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
      </body>
    </html>
  );
}
