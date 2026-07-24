"use client";

import { useEffect } from "react";
import { tryRecoverClient } from "@/lib/client-error-recovery";

export default function GlobalError({
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
    <html lang="es">
      <body>
        <main className="app-error-screen">
          <section className="app-error-card">
            <span className="app-error-mark">BSC</span>
            <h1>Estamos recuperando la aplicacion</h1>
            <p>
              Se detecto un cambio de version. Intenta nuevamente para cargar
              los archivos actualizados.
            </p>
            <button className="primary-button" onClick={reset} type="button">
              Intentar de nuevo
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
