import { getDb } from "@/lib/db";

export type AuditActor = {
  name?: string | null;
  userId?: string | null;
};

export async function recordAuditLog(input: {
  action: string;
  actor?: AuditActor | null;
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown> | null;
  summary?: string | null;
}) {
  await getDb().query(
    `
      INSERT INTO audit_log (
        actor_user_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        summary,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.actor?.userId ?? null,
      input.actor?.name ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.summary ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null
    ]
  );
}
