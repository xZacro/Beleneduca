export function resolveStorageMode() {
  return process.env.FNI_API_STORAGE === "prisma" ? "prisma" : "json";
}

// Factoría pequeña: el resto del backend trabaja contra este contrato unico.
export async function createStorage() {
  if (resolveStorageMode() === "prisma") {
    const { createPrismaStorage } = await import("./fni-storage-prisma.mjs");
    return createPrismaStorage();
  }

  const { createJsonStorage } = await import("./fni-storage-json.mjs");
  return createJsonStorage();
}
