import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var bloqueraPool: Pool | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  if (!global.bloqueraPool) {
    global.bloqueraPool = new Pool({
      connectionString,
      ssl:
        process.env.POSTGRES_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined
    });
  }

  return global.bloqueraPool;
}
