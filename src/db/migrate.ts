import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

async function main() {
  console.log("→ Running migrations...");
  const sql = postgres(connectionString!, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  await sql.end();
  console.log("✓ Migrations complete");
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
