const RECOVERY_KEY = "bsc-client-recovery";
const RECOVERY_WINDOW_MS = 60_000;
const RECOVERABLE_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "css_chunk_load_failed",
  "/_next/static/",
  "hydration",
  "react error #418",
  "react error #423"
];

export function isRecoverableClientError(...values: unknown[]) {
  const message = values
    .map((value) => {
      if (value instanceof Error) return `${value.name} ${value.message}`;
      return String(value ?? "");
    })
    .join(" ")
    .toLowerCase();

  return RECOVERABLE_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern)
  );
}

export function tryRecoverClient(error: unknown) {
  if (typeof window === "undefined") {
    return false;
  }

  const message = getErrorMessage(error);
  const recoveryRecord = readRecoveryRecord();
  const now = Date.now();

  if (
    recoveryRecord &&
    recoveryRecord.path === window.location.pathname &&
    now - recoveryRecord.at < RECOVERY_WINDOW_MS
  ) {
    return false;
  }

  try {
    sessionStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify({
        at: now,
        message: message.slice(0, 300),
        path: window.location.pathname
      })
    );
  } catch {
    // Some browser privacy modes disable session storage. Recovery can continue.
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("_clientRefresh", String(now));
  window.location.replace(nextUrl.toString());

  return true;
}

export function forceReloadClient() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Reloading does not depend on session storage being available.
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("_clientRefresh", String(Date.now()));
  window.location.replace(nextUrl.toString());
}

export function clearRecoveryQuery() {
  if (typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (!currentUrl.searchParams.has("_clientRefresh")) {
    return;
  }

  currentUrl.searchParams.delete("_clientRefresh");
  window.history.replaceState({}, "", currentUrl.toString());
}

function readRecoveryRecord() {
  try {
    const value = sessionStorage.getItem(RECOVERY_KEY);
    return value
      ? (JSON.parse(value) as { at: number; message: string; path: string })
      : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error ?? "Unknown client error");
}
