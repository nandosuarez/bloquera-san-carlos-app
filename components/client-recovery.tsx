"use client";

import { useEffect } from "react";
import {
  clearRecoveryQuery,
  tryRecoverClient
} from "@/lib/client-error-recovery";

export function ClientRecovery() {
  useEffect(() => {
    clearRecoveryQuery();

    function handleError(event: ErrorEvent) {
      if (isAssetOrHydrationError(event.error, event.message, event.filename)) {
        tryRecoverClient(event.error ?? event.message);
      }
    }

    function handleRejection(event: PromiseRejectionEvent) {
      if (isAssetOrHydrationError(event.reason)) {
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

function isAssetOrHydrationError(...values: unknown[]) {
  const message = values
    .map((value) => {
      if (value instanceof Error) return `${value.name} ${value.message}`;
      return String(value ?? "");
    })
    .join(" ")
    .toLowerCase();

  return [
    "chunkloaderror",
    "loading chunk",
    "failed to fetch dynamically imported module",
    "css_chunk_load_failed",
    "/_next/static/",
    "hydration",
    "react error #418",
    "react error #423"
  ].some((pattern) => message.includes(pattern));
}
