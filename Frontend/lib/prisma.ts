import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Prisma");
  }

  const url = new URL(databaseUrl);
  const allowPublicKeyRetrieval =
    (process.env.MARIADB_ALLOW_PUBLIC_KEY_RETRIEVAL ?? "true").toLowerCase() === "true";
  const cachingRsaPublicKey = process.env.MARIADB_CACHING_RSA_PUBLIC_KEY?.trim() || undefined;

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
    allowPublicKeyRetrieval,
    ...(cachingRsaPublicKey ? { cachingRsaPublicKey } : {}),
  });

  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: any;
};

// ✅ Named export for new routes
export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// ✅ Default export — Proxy so existing routes keep working
// But client is only created on first property ACCESS, not import
const prismaProxy = new Proxy({} as any, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});

export default prismaProxy;