import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// Lazy singleton: initialize the connection on first use, not at module load.
// This lets `next build` (page data collection) import this module without
// requiring DATABASE_URL at build time.
declare global {
  // eslint-disable-next-line no-var
  var __invoiceDb: DrizzleDB | undefined;
}

function createDb(): DrizzleDB {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const queryClient = postgres(connectionString, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(queryClient, { schema });
}

export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    if (!global.__invoiceDb) {
      global.__invoiceDb = createDb();
    }
    return Reflect.get(global.__invoiceDb, prop, receiver);
  },
});

export type DB = typeof db;
