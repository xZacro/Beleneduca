import { createPrismaClient } from "./prisma-client.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRoles(roles) {
  return Array.isArray(roles) ? roles.filter((role) => typeof role === "string") : [];
}

export function createPrismaAuditStore() {
  let prisma = null;

  function getClient() {
    if (!prisma) {
      prisma = createPrismaClient();
    }

    return prisma;
  }

  return {
    async init() {
      await getClient().$connect();
    },
    async close() {
      if (prisma) {
        await prisma.$disconnect();
      }
    },
    async recordEvent(type, actor, meta = null) {
      const client = getClient();
      const email =
        typeof actor?.email === "string" && actor.email.trim()
          ? actor.email.trim().toLowerCase()
          : null;
      const user =
        email == null
          ? null
          : await client.user.findUnique({
              where: { email },
              select: { id: true },
            });

      await client.auditEvent.create({
        data: {
          type,
          actorUserId: user?.id ?? null,
          actorName:
            typeof actor?.name === "string" && actor.name.trim() ? actor.name.trim() : "Sistema",
          actorEmail: email ?? "system@local",
          actorSchoolId:
            typeof actor?.schoolId === "string" && actor.schoolId.trim() ? actor.schoolId.trim() : null,
          actorRoles: normalizeRoles(actor?.roles),
          meta: isRecord(meta) ? meta : null,
        },
      });
    },
  };
}
