import { createPrismaClient } from "./prisma-client.mjs";
import { hashPassword } from "./fni-passwords.mjs";

const VALID_ROLES = new Set(["ADMIN", "FUNDACION", "COLEGIO"]);
const VALID_USER_STATUSES = new Set(["ACTIVE", "INVITED", "DISABLED"]);

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) {
    throw new Error("Debes enviar al menos un rol.");
  }

  const normalized = [...new Set(roles.map((role) => String(role).trim().toUpperCase()))];

  if (!normalized.every((role) => VALID_ROLES.has(role))) {
    throw new Error("Se enviaron roles invalidos.");
  }

  return normalized;
}

function normalizeStatus(status) {
  const normalized = String(status ?? "ACTIVE").trim().toUpperCase();
  if (!VALID_USER_STATUSES.has(normalized)) {
    throw new Error("El estado del usuario es invalido.");
  }

  return normalized;
}

function normalizeEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) {
    throw new Error("El email es obligatorio.");
  }

  return normalized;
}

function normalizeName(name) {
  const normalized = String(name ?? "").trim();
  if (!normalized) {
    throw new Error("El nombre es obligatorio.");
  }

  return normalized;
}

function normalizeSchoolId(roles, schoolId) {
  const normalizedSchoolId = isNonEmptyString(schoolId) ? String(schoolId).trim() : null;

  if (roles.includes("COLEGIO") && !normalizedSchoolId) {
    throw new Error("Los usuarios con rol Colegio deben estar asociados a un colegio.");
  }

  if (!roles.includes("COLEGIO")) {
    return null;
  }

  return normalizedSchoolId;
}

function mapSchool(school) {
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    managerName: school.managerName ?? null,
    managerEmail: school.managerEmail ?? null,
    status: school.status,
  };
}

function mapCycle(cycle) {
  const closedAt = toIsoOrNull(cycle.closedAt);

  return {
    id: cycle.id,
    name: cycle.name,
    status: cycle.status,
    startsAt: toIsoOrNull(cycle.startsAt),
    endsAt: toIsoOrNull(cycle.endsAt),
    closedAt,
    isClosed: Boolean(closedAt || cycle.status === "CLOSED"),
  };
}

function mapUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: (user.roles ?? []).map((role) => role.role),
    schoolId: user.schoolId ?? null,
    schoolName: user.school?.name ?? null,
    status: user.status,
    createdAt: toIsoOrNull(user.createdAt),
    updatedAt: toIsoOrNull(user.updatedAt),
  };
}

function mapSession(session) {
  return {
    id: session.id,
    userId: session.userId,
    userEmail: session.user?.email ?? "",
    userName: session.user?.name ?? "",
    roles: (session.user?.roles ?? []).map((role) => role.role),
    schoolId: session.user?.schoolId ?? null,
    status: session.status,
    lastSeenAt: toIsoOrNull(session.lastSeenAt),
    lastLoginAt: toIsoOrNull(session.lastLoginAt),
    lastLogoutAt: toIsoOrNull(session.lastLogoutAt),
    ipAddress: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
    createdAt: toIsoOrNull(session.createdAt),
    updatedAt: toIsoOrNull(session.updatedAt),
  };
}

function mapAuditEvent(event) {
  return {
    id: event.id,
    type: event.type,
    at: toIsoOrNull(event.at),
    actorUserId: event.actorUserId ?? null,
    actorName: event.actorName,
    actorEmail: event.actorEmail,
    actorSchoolId: event.actorSchoolId ?? null,
    actorRoles: Array.isArray(event.actorRoles) ? event.actorRoles : [],
    meta: event.meta ?? null,
  };
}

async function requireExistingSchool(tx, schoolId) {
  if (!schoolId) return null;

  const school = await tx.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });

  if (!school) {
    throw new Error("El colegio seleccionado no existe.");
  }

  return school;
}

async function createAuditEvent(tx, actorEmail, meta) {
  const actor = await tx.user.findUnique({
    where: { email: actorEmail },
    include: { roles: true },
  });

  if (!actor) return;

  await tx.auditEvent.create({
    data: {
      type: "CHANGE",
      actorUserId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorSchoolId: actor.schoolId ?? null,
      actorRoles: actor.roles.map((role) => role.role),
      meta,
    },
  });
}

async function persistUserRoles(tx, userId, roles) {
  await tx.userRole.deleteMany({
    where: { userId },
  });

  await tx.userRole.createMany({
    data: roles.map((role) => ({
      userId,
      role,
    })),
  });
}

async function getUserDto(tx, userId) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      school: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("No se encontro el usuario solicitado.");
  }

  return mapUser(user);
}

async function countOtherActiveAdmins(tx, excludedUserId) {
  return tx.user.count({
    where: {
      id: {
        not: excludedUserId,
      },
      status: "ACTIVE",
      roles: {
        some: {
          role: "ADMIN",
        },
      },
    },
  });
}

export function createPrismaManagementProvider() {
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
    async listSchools(currentUser) {
      const prisma = getClient();
      const where =
        currentUser.roles.includes("ADMIN") || currentUser.roles.includes("FUNDACION")
          ? {}
          : { id: currentUser.schoolId ?? "__no_school__" };

      const schools = await prisma.school.findMany({
        where,
        orderBy: [{ code: "asc" }, { name: "asc" }],
      });

      return schools.map(mapSchool);
    },
    async listCycles() {
      const prisma = getClient();
      const cycles = await prisma.cycle.findMany({
        orderBy: { id: "desc" },
      });

      return cycles.map(mapCycle);
    },
    async listUsers() {
      const prisma = getClient();
      const users = await prisma.user.findMany({
        include: {
          roles: true,
          school: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { email: "asc" },
      });

      return users.map(mapUser);
    },
    async createUser(payload, actorUser) {
      const prisma = getClient();
      const roles = normalizeRoles(payload.roles);
      const name = normalizeName(payload.name);
      const email = normalizeEmail(payload.email);
      const status = normalizeStatus(payload.status);
      const schoolId = normalizeSchoolId(roles, payload.schoolId);
      const password = String(payload.password ?? "");

      if (password.trim().length < 4) {
        throw new Error("La contraseña inicial debe tener al menos 4 caracteres.");
      }

      return prisma.$transaction(async (tx) => {
        await requireExistingSchool(tx, schoolId);

        const user = await tx.user.create({
          data: {
            name,
            email,
            schoolId,
            status,
            passwordHash: hashPassword(password),
          },
        });

        await persistUserRoles(tx, user.id, roles);
        await createAuditEvent(tx, actorUser.email, {
          action: "USER_CREATED",
          targetUserId: user.id,
          targetEmail: email,
          roles,
          schoolId,
          status,
        });

        return getUserDto(tx, user.id);
      });
    },
    async updateUser(userId, payload, actorUser) {
      const prisma = getClient();
      const roles = normalizeRoles(payload.roles);
      const name = normalizeName(payload.name);
      const email = normalizeEmail(payload.email);
      const status = normalizeStatus(payload.status);
      const schoolId = normalizeSchoolId(roles, payload.schoolId);

      return prisma.$transaction(async (tx) => {
        await requireExistingSchool(tx, schoolId);

        const existing = await tx.user.findUnique({
          where: { id: userId },
          include: {
            roles: true,
          },
        });

        if (!existing) {
          throw new Error("No se encontro el usuario a actualizar.");
        }

        const editingSelf = existing.email === actorUser.email;
        const removesAdmin = existing.roles.some((role) => role.role === "ADMIN") && !roles.includes("ADMIN");
        const disablesUser = status === "DISABLED";

        if (editingSelf && (removesAdmin || disablesUser)) {
          throw new Error("No puedes desactivar tu propio usuario ni quitarte el rol Admin.");
        }

        if (existing.roles.some((role) => role.role === "ADMIN") && (removesAdmin || status !== "ACTIVE")) {
          const otherActiveAdmins = await countOtherActiveAdmins(tx, userId);
          if (otherActiveAdmins === 0) {
            throw new Error("Debe existir al menos un usuario Admin activo.");
          }
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            name,
            email,
            schoolId,
            status,
          },
        });

        await persistUserRoles(tx, userId, roles);

        if (status === "DISABLED") {
          await tx.userSession.updateMany({
            where: {
              userId,
              status: {
                in: ["ONLINE", "IDLE"],
              },
            },
            data: {
              status: "REVOKED",
              lastLogoutAt: new Date(),
            },
          });
        }

        await createAuditEvent(tx, actorUser.email, {
          action: "USER_UPDATED",
          targetUserId: userId,
          previousEmail: existing.email,
          targetEmail: email,
          roles,
          schoolId,
          status,
        });

        return getUserDto(tx, userId);
      });
    },
    async resetUserPassword(userId, password, actorUser) {
      const prisma = getClient();
      const normalizedPassword = String(password ?? "");

      if (normalizedPassword.trim().length < 4) {
        throw new Error("La nueva contraseña debe tener al menos 4 caracteres.");
      }

      await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true },
        });

        if (!existing) {
          throw new Error("No se encontro el usuario para resetear contraseña.");
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash: hashPassword(normalizedPassword),
          },
        });

        await tx.userSession.updateMany({
          where: {
            userId,
            status: {
              in: ["ONLINE", "IDLE"],
            },
          },
          data: {
            status: "REVOKED",
            lastLogoutAt: new Date(),
          },
        });

        await createAuditEvent(tx, actorUser.email, {
          action: "USER_PASSWORD_RESET",
          targetUserId: userId,
          targetEmail: existing.email,
        });
      });
    },
    async listSessions() {
      const prisma = getClient();
      const sessions = await prisma.userSession.findMany({
        include: {
          user: {
            include: {
              roles: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
        take: 200,
      });

      return sessions.map(mapSession);
    },
    async listAudit() {
      const prisma = getClient();
      const events = await prisma.auditEvent.findMany({
        orderBy: { at: "desc" },
        take: 200,
      });

      return events.map(mapAuditEvent);
    },
  };
}
