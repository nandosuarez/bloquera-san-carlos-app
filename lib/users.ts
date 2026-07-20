import { getDb } from "@/lib/db";

type UserRow = {
  created_at: Date;
  email: string;
  id: string;
  is_active: boolean;
  name: string;
  password_hash: string;
  role: string;
  updated_at: Date;
  username: string;
};

export type AppUser = {
  createdAt: Date;
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  passwordHash: string;
  role: string;
  updatedAt: Date;
  username: string;
};

export async function findUserByUsername(
  username: string
): Promise<AppUser | null> {
  const result = await getDb().query<UserRow>(
    `
      SELECT
        id,
        name,
        email,
        username,
        password_hash,
        role,
        is_active,
        created_at,
        updated_at
      FROM app_user
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `,
    [username.trim()]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    updatedAt: row.updated_at,
    username: row.username
  };
}
