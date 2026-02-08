import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:taxes.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      is_paid BOOLEAN DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default social security limit for 2025/2026 if not exists
  // 105,000 CZK is the limit for "rozhodná částka"
  const limitSetting = await db.execute(
    "SELECT * FROM settings WHERE key = 'social_limit_amount'",
  );
  if (limitSetting.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?)",
      args: ["social_limit_amount", "105000"],
    });
  }
}
