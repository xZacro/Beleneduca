import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL no esta configurado.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
