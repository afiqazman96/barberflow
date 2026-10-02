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
    //
    // The timeouts make a dead connection fail instead of hang. A socket the
    // pooler dropped while the machine slept (or the network blinked) never
    // answers, and without a limit the query waits on it forever — five of
    // those and every request queues behind them until a restart.
    adapter: new PrismaPg({
      connectionString,
      max: 5,
      keepAlive: true,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

// So is the client class itself. `prisma generate` after a schema change
// rewrites `src/generated/prisma`, and the dev server reloads it — but a
// cached instance of the *old* class still validates queries against the old
// schema, rejecting every new column until the server is restarted.
const cachedIsStale =
  globalForPrisma.prismaConnectionString !== process.env.DATABASE_URL ||
  !(globalForPrisma.prisma instanceof PrismaClient);

if (cachedIsStale && globalForPrisma.prisma) {
  // Hand the old pool's connections back rather than leaking them.
  void globalForPrisma.prisma.$disconnect().catch(() => {});
}

export const prisma =
  globalForPrisma.prisma && !cachedIsStale
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConnectionString = process.env.DATABASE_URL;
}
