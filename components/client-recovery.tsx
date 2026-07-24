"use client";

import { useEffect } from "react";
import {
  clearRecoveryQuery,
  isRecoverableClientError,
  tryRecoverClient
} from "@/lib/client-error-recovery";

export function ClientRecovery() {
  useEffect(() => {
    clearRecoveryQuery();

    function handleError(event: ErrorEvent) {
      if (
        isRecoverableClientError(
          event.error,
          event.message,
          event.filename
        )
      ) {
        tryRecoverClient(event.error ?? event.message);
      }
    }

    function handleRejection(event: PromiseRejectionEvent) {
      if (isRecoverableClientError(event.reason)) {
        tryRecoverClient(event.reason);
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
