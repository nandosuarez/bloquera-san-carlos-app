import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "database", "schema.sql");
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const adminName = process.env.ADMIN_NAME || "Administrador Bloquera";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.POSTGRES_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
  });

  const client = await pool.connect();

  try {
    const schemaSql = await readFile(schemaPath, "utf8");
    await client.query(schemaSql);

    const passwordHash = await hashPassword(adminPassword);

    await client.query(
      `
        INSERT INTO app_user (name, email, username, password_hash, role)
        VALUES ($1, LOWER($2), LOWER($3), $4, 'SUPERADMIN')
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = TRUE
      `,
      [adminName, adminEmail, adminUsername, passwordHash]
    );

    console.log("Database ready. Admin user seeded successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
