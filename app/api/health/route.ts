import { NextResponse } from "next/server";
import { ensureCuentiSyncScheduler } from "@/lib/cuenti-sync-scheduler";

export async function GET() {
  ensureCuentiSyncScheduler();

  return NextResponse.json({
    ok: true,
    service: "bloquera-san-carlos",
    status: "healthy"
  });
}
