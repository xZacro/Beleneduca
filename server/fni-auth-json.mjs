import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { recordAuditEvent } from "./fni-audit.mjs";
import { DEMO_AUTH_USERS } from "./fni-demo-users.mjs";
import { resolveApiDataDir } from "./fni-data-dir.mjs";
import { hashPassword, verifyPassword } from "./fni-passwords.mjs";

// Proveedor de auth en JSON: sesiones y usuarios locales para desarrollo rapido.
const dataDir = resolveApiDataDir();
const sessionsPath = path.join(dataDir, "sessions.json");
const usersPath = path.join(dataDir, "users.json");
const SESSION_COOKIE = "fni_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HEARTBEAT_AUDIT_INTERVAL_MS = 15 * 60 * 1000;

let sessionsWriteQueue = Promise.resolve();
let usersWriteQueue = Promise.resolve();

function defaultSessionsDb() {
  return {
    sessions: {},
  };
}

function defaultUsersDb() {
  return {
    users: Object.fromEntries(
      DEMO_AUTH_USERS.map((user) => [
        user.email,
        {
          ...user,
          status: "ACTIVE",
        },
      ])
    ),
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

function toSafeUser(user) {
  return {
    name: user.name,
    email: user.email,
    roles: [...user.roles],
    schoolId: user.schoolId ?? null,
  };
}

function normalizeJsonUser(email, value) {
  if (!isRecord(value)) return null;

  return {
    email,
    name: typeof value.name === "string" ? value.name : email,
    roles: Array.isArray(value.roles) ? value.roles.filter((role) => typeof role === "string") : [],
    schoolId: typeof value.schoolId === "string" ? value.schoolId : null,
    password: typeof value.password === "string" ? value.password : "",
    status: typeof value.status === "string" ? value.status : "ACTIVE",
  };
}

async function ensureFile(filePath, fallback) {
  try {
    await access(filePath);
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function ensureSessionsFile() {
  await ensureFile(sessionsPath, defaultSessionsDb());
}

async function ensureUsersFile() {
  await ensureFile(usersPath, defaultUsersDb());
}

async function readSessionsDb() {
  await ensureSessionsFile();

  try {
    const raw = await readFile(sessionsPath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      sessions: isRecord(parsed.sessions) ? parsed.sessions : {},
    };
  } catch {
    return defaultSessionsDb();
  }
}

async function readUsersDb() {
  await ensureUsersFile();

  try {
    const raw = await readFile(usersPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: isRecord(parsed.users) ? parsed.users : defaultUsersDb().users,
    };
  } catch {
    return defaultUsersDb();
  }
}

async function getJsonUserByEmail(email) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const db = await readUsersDb();
  return normalizeJsonUser(normalizedEmail, db.users[normalizedEmail]);
}

function updateSessionsDb(mutator) {
  const nextWrite = sessionsWriteQueue.then(async () => {
    const db = await readSessionsDb();
    const result = await mutator(db);
    await mkdir(dataDir, { recursive: true });
    await writeFile(sessionsPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return result;
  });

  sessionsWriteQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

function updateUsersDb(mutator) {
  const nextWrite = usersWriteQueue.then(async () => {
    const db = await readUsersDb();
    const result = await mutator(db);
    await mkdir(dataDir, { recursive: true });
    await writeFile(usersPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return result;
  });

  usersWriteQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

export function createJsonAuthProvider() {
  return {
    async init() {
      await Promise.all([ensureSessionsFile(), ensureUsersFile()]);
    },
    async close() {},
    async loginWithCredentials(email, password) {
      // La validacion se hace contra usuarios locales y se registra auditoria igual que en Prisma.
      const normalizedEmail = String(email ?? "").trim().toLowerCase();
      const normalizedPassword = String(password ?? "");
      const user = await getJsonUserByEmail(normalizedEmail);

      if (!user || user.status !== "ACTIVE" || !verifyPassword(normalizedPassword, user.password)) {
        return null;
      }

      const sessionToken = randomUUID();
      const now = new Date().toISOString();

      await updateSessionsDb((db) => {
        db.sessions[sessionToken] = {
          email: normalizedEmail,
          createdAt: now,
          lastSeenAt: now,
          lastHeartbeatAuditAt: now,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        };
      });

      await recordAuditEvent("LOGIN", toSafeUser(user), {
        source: "api",
        storage: "json",
      });

      return {
        sessionToken,
        user: toSafeUser(user),
      };
    },
    async getSessionFromRequest(request) {
      // Extraemos la cookie local y validamos expiracion + estado del usuario.
      const cookies = parseCookies(request.headers.cookie);
      const sessionToken = cookies[SESSION_COOKIE];

      if (!sessionToken) return null;

      const db = await readSessionsDb();
      const session = db.sessions[sessionToken];

      if (!isRecord(session) || typeof session.email !== "string") {
        return null;
      }

      const expiresAt =
        typeof session.expiresAt === "string" ? new Date(session.expiresAt) : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        await updateSessionsDb((currentDb) => {
          delete currentDb.sessions[sessionToken];
        });
        return null;
      }

      const user = await getJsonUserByEmail(session.email);
      if (!user || user.status !== "ACTIVE") {
        await updateSessionsDb((currentDb) => {
          delete currentDb.sessions[sessionToken];
        });
        return null;
      }

      return {
        sessionToken,
        user: toSafeUser(user),
      };
    },
    async touchSession(sessionToken) {
      if (!sessionToken) return;

      await updateSessionsDb((db) => {
        const session = db.sessions[sessionToken];
        if (!isRecord(session)) return;

        session.lastSeenAt = new Date().toISOString();
        session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      });
    },
    async recordHeartbeat(sessionToken) {
      if (!sessionToken) return;

      let shouldAudit = false;
      let actor = null;

      await updateSessionsDb((db) => {
        const session = db.sessions[sessionToken];
        if (!isRecord(session)) return;

        const lastAuditAt =
          typeof session.lastHeartbeatAuditAt === "string"
            ? new Date(session.lastHeartbeatAuditAt).getTime()
            : 0;
        shouldAudit =
          !lastAuditAt ||
          Number.isNaN(lastAuditAt) ||
          lastAuditAt + HEARTBEAT_AUDIT_INTERVAL_MS <= Date.now();
        session.lastSeenAt = new Date().toISOString();
        session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        if (shouldAudit) {
          session.lastHeartbeatAuditAt = session.lastSeenAt;
        }
        actor = typeof session.email === "string" ? session.email : null;
      });

      if (shouldAudit && actor) {
        const user = await getJsonUserByEmail(actor);
        if (user) {
          await recordAuditEvent("HEARTBEAT", toSafeUser(user), {
            source: "api",
            storage: "json",
          });
        }
      }
    },
    async logoutSession(sessionToken) {
      if (!sessionToken) return;

      const db = await readSessionsDb();
      const session = db.sessions[sessionToken];
      const actorEmail = isRecord(session) && typeof session.email === "string" ? session.email : null;

      await updateSessionsDb((db) => {
        delete db.sessions[sessionToken];
      });

      if (actorEmail) {
        const user = await getJsonUserByEmail(actorEmail);
        if (user) {
          await recordAuditEvent("LOGOUT", toSafeUser(user), {
            source: "api",
            storage: "json",
          });
        }
      }
    },
    async changePassword(sessionToken, currentPassword, newPassword) {
      // El cambio de contrasena actualiza el usuario local y revoca sesiones viejas de forma logica.
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

      const sessionsDb = await readSessionsDb();
      const session = sessionsDb.sessions[sessionToken];
      const email = isRecord(session) && typeof session.email === "string" ? session.email : null;

      if (!email) {
        throw new Error("No pudimos validar la sesion actual.");
      }

      const user = await getJsonUserByEmail(email);
      if (!user || user.status !== "ACTIVE") {
        throw new Error("No pudimos validar la sesion actual.");
      }

      if (!verifyPassword(normalizedCurrentPassword, user.password)) {
        throw new Error("La contrasena actual no coincide.");
      }

      await updateUsersDb((db) => {
        const current = normalizeJsonUser(email, db.users[email]);
        if (!current) {
          throw new Error("No pudimos validar la sesion actual.");
        }

        db.users[email] = {
          ...current,
          password: hashPassword(normalizedNewPassword),
        };
      });

      await recordAuditEvent("CHANGE", toSafeUser(user), {
        action: "PASSWORD_CHANGED",
        source: "api",
        storage: "json",
      });
    },
  };
}
