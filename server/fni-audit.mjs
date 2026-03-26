let providerPromise = null;

function resolveAuditMode() {
  return process.env.FNI_API_STORAGE === "prisma" ? "prisma" : "json";
}

async function getProvider() {
  if (!providerPromise) {
    providerPromise =
      resolveAuditMode() === "prisma"
        ? import("./fni-audit-prisma.mjs").then(({ createPrismaAuditStore }) =>
            createPrismaAuditStore()
          )
        : import("./fni-audit-json.mjs").then(() => ({
            init: () => import("./fni-audit-json.mjs").then(({ initJsonAuditStore }) => initJsonAuditStore()),
            close: async () => {},
            recordEvent: (type, actor, meta) =>
              import("./fni-audit-json.mjs").then(({ recordJsonAuditEvent }) =>
                recordJsonAuditEvent(type, actor, meta)
              ),
          }));
  }

  return providerPromise;
}

export async function initAuditStore() {
  const provider = await getProvider();
  await provider.init();
}

export async function closeAuditStore() {
  const provider = await getProvider();
  await provider.close();
}

export async function recordAuditEvent(type, actor, meta = null) {
  const provider = await getProvider();
  await provider.recordEvent(type, actor, meta);
}
