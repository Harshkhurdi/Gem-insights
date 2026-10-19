import "reflect-metadata";
import { DataSource } from "typeorm";
import { Initial1792400000000 } from "./migrations/initial";
export const db = new DataSource({
  type: "postgres",
  url:
    process.env.DATABASE_URL || "postgresql://localhost:55432/gem_intelligence",
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  migrations: [Initial1792400000000],
  synchronize: false,
  logging: false,
  extra: { max: 12, statement_timeout: 30000 },
});
export async function connect() {
  if (!db.isInitialized) await db.initialize();
  return db;
}
