const RECOVERY_KEY = "bsc-client-recovery";
const RECOVERY_WINDOW_MS = 60_000;

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

  sessionStorage.setItem(
    RECOVERY_KEY,
    JSON.stringify({
      at: now,
      message: message.slice(0, 300),
      path: window.location.pathname
    })
  );
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("_clientRefresh", String(now));
  window.location.replace(nextUrl.toString());

  return true;
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
