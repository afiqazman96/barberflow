import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Next.js dev server hot-reloads modules on every edit. Without caching the
// client on globalThis, each reload opens a fresh connection pool and Postgres
// eventually refuses new connections.
//
// The cached connection string is part of the key: Next reloads `.env` in
// place without restarting, so a cache keyed on nothing would keep serving
// queries to the *previous* database long after DATABASE_URL changed. That
// failure is near-impossible to read from the app — you get authentic logins
// that resolve to no staff row, i.e. "this account is not linked to a shop".
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the Supabase transaction pooler URL (port 6543).",
    );
  }

  return new PrismaClient({
    // DATABASE_URL points at Supabase's transaction pooler, which already
    // multiplexes onto a small set of server connections. Keeping our own pool
    // tiny stops a handful of serverless instances from exhausting it.
    adapter: new PrismaPg({ connectionString, max: 5 }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

const cachedIsStale =
  globalForPrisma.prismaConnectionString !== process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma && !cachedIsStale
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConnectionString = process.env.DATABASE_URL;
}
