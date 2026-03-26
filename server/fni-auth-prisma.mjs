import { randomUUID } from "node:crypto";

import { hashPassword, hashSessionToken, verifyPassword } from "./fni-passwords.mjs";
import { createPrismaClient } from "./prisma-client.mjs";

// Proveedor de auth en Prisma: replica el mismo contrato, pero sobre PostgreSQL.
const SESSION_COOKIE = "fni_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HEARTBEAT_AUDIT_INTERVAL_MS = 15 * 60 * 1000;

function parseCookies(rawCookie) {
  if (!rawCookie) return {};

  return Object.fromEntries(
    rawCookie
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        const key = separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
        const value = separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : "";
        return [key, decodeURIComponent(value)];
      })
  );
}

function getRequestIpAddress(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (typeof value === "string" && value.trim()) {
    return value.split(",")[0].trim();
  }

  return request.socket?.remoteAddress ?? null;
}

function toSafeUser(user) {
  return {
    name: user.name,
    email: user.email,
    roles: (user.roles ?? []).map((role) => role.role),
    schoolId: user.schoolId ?? null,
  };
}

function isSessionExpired(session) {
  const reference = session.lastSeenAt ?? session.lastLoginAt ?? session.updatedAt ?? null;
  if (!reference) return false;

  const timestamp = new Date(reference).getTime();
  if (Number.isNaN(timestamp)) return true;

  return timestamp + SESSION_TTL_MS <= Date.now();
}

async function createAuditEvent(prisma, type, user, meta = null) {
  await prisma.auditEvent.create({
    data: {
      type,
      actorUserId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorSchoolId: user.schoolId ?? null,
      actorRoles: (user.roles ?? []).map((role) => role.role),
      meta,
    },
  });
}

export function createPrismaAuthProvider() {
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
    async loginWithCredentials(email, password, request) {
      // El login valida credenciales y abre una sesion persistida y trazable.
      const prisma = getClient();
      const normalizedEmail = String(email ?? "").trim().toLowerCase();
      const normalizedPassword = String(password ?? "");

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          roles: true,
        },
      });

      if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
        return null;
      }

      if (!verifyPassword(normalizedPassword, user.passwordHash)) {
        return null;
      }

      const sessionToken = randomUUID();
      const tokenHash = hashSessionToken(sessionToken);
      const now = new Date();
      const ipAddress = getRequestIpAddress(request);
      const userAgent = request.headers["user-agent"] ?? null;

      await prisma.$transaction(async (tx) => {
        await tx.userSession.create({
          data: {
            userId: user.id,
            tokenHash,
            status: "ONLINE",
            lastSeenAt: now,
            lastLoginAt: now,
            ipAddress,
            userAgent: typeof userAgent === "string" ? userAgent : null,
          },
        });

        await createAuditEvent(tx, "LOGIN", user, {
          source: "api",
          storage: "prisma",
        });
      });

      return {
        sessionToken,
        user: toSafeUser(user),
      };
    },
    async getSessionFromRequest(request) {
      // La cookie contiene un token opaco; en la base guardamos solo el hash.
      const prisma = getClient();
      const cookies = parseCookies(request.headers.cookie);
      const sessionToken = cookies[SESSION_COOKIE];

      if (!sessionToken) return null;

      const session = await prisma.userSession.findUnique({
        where: {
          tokenHash: hashSessionToken(sessionToken),
        },
        include: {
          user: {
            include: {
              roles: true,
            },
          },
        },
      });

      if (!session || !session.user || session.user.status !== "ACTIVE") {
        return null;
      }

      if (session.status === "REVOKED" || session.status === "OFFLINE") {
        return null;
      }

      if (isSessionExpired(session)) {
        await prisma.userSession.update({
          where: { id: session.id },
          data: {
            status: "REVOKED",
            lastLogoutAt: new Date(),
          },
        });
        return null;
      }

      return {
        sessionToken,
        user: toSafeUser(session.user),
      };
    },
    async touchSession(sessionToken) {
      if (!sessionToken) return;

      const prisma = getClient();

      await prisma.userSession.updateMany({
        where: {
          tokenHash: hashSessionToken(sessionToken),
          status: {
            in: ["ONLINE", "IDLE"],
          },
        },
        data: {
          status: "ONLINE",
          lastSeenAt: new Date(),
        },
      });
    },
    async recordHeartbeat(sessionToken) {
      if (!sessionToken) return;

      const prisma = getClient();
      const tokenHash = hashSessionToken(sessionToken);
      const session = await prisma.userSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              roles: true,
            },
          },
        },
      });

      if (!session || !session.user) return;
      if (session.status === "REVOKED" || session.status === "OFFLINE") return;

      const now = new Date();
      const lastSeenAt = session.lastSeenAt ?? session.lastLoginAt ?? session.updatedAt ?? null;
      const shouldAudit =
        !lastSeenAt ||
        Number.isNaN(new Date(lastSeenAt).getTime()) ||
        new Date(lastSeenAt).getTime() + HEARTBEAT_AUDIT_INTERVAL_MS <= now.getTime();

      await prisma.$transaction(async (tx) => {
        await tx.userSession.update({
          where: { id: session.id },
          data: {
            status: "ONLINE",
            lastSeenAt: now,
          },
        });

        if (shouldAudit) {
          await createAuditEvent(tx, "HEARTBEAT", session.user, {
            source: "api",
            storage: "prisma",
          });
        }
      });
    },
    async logoutSession(sessionToken) {
      if (!sessionToken) return;

      const prisma = getClient();
      const tokenHash = hashSessionToken(sessionToken);

      const session = await prisma.userSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              roles: true,
            },
          },
        },
      });

      if (!session) return;

      await prisma.$transaction(async (tx) => {
        await tx.userSession.update({
          where: { id: session.id },
          data: {
            status: "REVOKED",
            lastLogoutAt: new Date(),
          },
        });

        if (session.user) {
          await createAuditEvent(tx, "LOGOUT", session.user, {
            source: "api",
            storage: "prisma",
          });
        }
      });
    },
    async changePassword(sessionToken, currentPassword, newPassword) {
      // Cambiar la contrasena invalida sesiones activas del mismo usuario para seguridad.
      const prisma = getClient();
      const normalizedCurrentPassword = String(currentPassword ?? "");
      const normalizedNewPassword = String(newPassword ?? "");

      if (!normalizedCurrentPassword.trim()) {
        throw new Error("La contrasena actual es obligatoria.");
      }

      if (normalizedNewPassword.trim().length < 4) {
        throw new Error("La nueva contrasena debe tener al menos 4 caracteres.");
      }

      if (normalizedCurrentPassword === normalizedNewPassword) {
        throw new Error("La nueva contrasena debe ser distinta a la actual.");
      }

      const tokenHash = hashSessionToken(sessionToken);

      await prisma.$transaction(async (tx) => {
        const session = await tx.userSession.findUnique({
          where: { tokenHash },
          include: {
            user: {
              include: {
                roles: true,
              },
            },
          },
        });

        if (!session || !session.user || session.user.status !== "ACTIVE") {
          throw new Error("No pudimos validar la sesion actual.");
        }

        if (!session.user.passwordHash || !verifyPassword(normalizedCurrentPassword, session.user.passwordHash)) {
          throw new Error("La contrasena actual no coincide.");
        }

        await tx.user.update({
          where: { id: session.user.id },
          data: {
            passwordHash: hashPassword(normalizedNewPassword),
          },
        });

        await tx.userSession.updateMany({
          where: {
            userId: session.user.id,
            status: {
              in: ["ONLINE", "IDLE"],
            },
            NOT: {
              id: session.id,
            },
          },
          data: {
            status: "REVOKED",
            lastLogoutAt: new Date(),
          },
        });

        await tx.userSession.update({
          where: { id: session.id },
          data: {
            status: "ONLINE",
            lastSeenAt: new Date(),
          },
        });

        await createAuditEvent(tx, "CHANGE", session.user, {
          action: "PASSWORD_CHANGED",
          source: "api",
          storage: "prisma",
        });
      });
    },
  };
}
