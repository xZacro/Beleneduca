import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEMO_AUTH_USERS } from "./fni-demo-users.mjs";
import { listJsonAuditEvents } from "./fni-audit-json.mjs";
import { resolveApiDataDir } from "./fni-data-dir.mjs";
import { DEFAULT_CYCLES, DEMO_SCHOOLS } from "./fni-domain.mjs";

const dataDir = resolveApiDataDir();
const sessionsPath = path.join(dataDir, "sessions.json");
const dbPath = path.join(dataDir, "db.json");

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseJson(raw, fallback);
  } catch {
    return fallback;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function mapSchool(school) {
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    managerName: school.managerName ?? null,
    managerEmail: school.managerEmail ?? null,
    status: "ACTIVE",
  };
}

function mapCycle(cycle, override = null) {
  const name =
    typeof override?.name === "string" && override.name.trim() ? override.name : cycle.name;
  const startsAt = hasOwn(override, "startsAt")
    ? override.startsAt ?? null
    : cycle.startsAt?.toISOString?.() ?? null;
  const endsAt = hasOwn(override, "endsAt")
    ? override.endsAt ?? null
    : cycle.endsAt?.toISOString?.() ?? null;
  const closedAt = hasOwn(override, "closedAt")
    ? override.closedAt ?? null
    : cycle.closedAt?.toISOString?.() ?? null;
  const baseStatus = typeof override?.status === "string" ? override.status : cycle.status;
  const status = closedAt ? "CLOSED" : baseStatus === "ARCHIVED" ? "ARCHIVED" : "OPEN";

  return {
    id: cycle.id,
    name,
    status,
    startsAt,
    endsAt,
    closedAt,
    isClosed: Boolean(closedAt || status === "CLOSED"),
  };
}

function mapUser(user, index) {
  return {
    id: `demo-user-${index + 1}`,
    name: user.name,
    email: user.email,
    roles: [...user.roles],
    schoolId: user.schoolId ?? null,
    schoolName: DEMO_SCHOOLS.find((school) => school.id === user.schoolId)?.name ?? null,
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
  };
}

function mapSession(sessionEntries, demoUsers) {
  return sessionEntries
    .map(([token, session], index) => {
      const user = demoUsers.find((candidate) => candidate.email === session.email);
      if (!user) return null;

      return {
        id: `demo-session-${index + 1}`,
        sessionToken: token,
        userId: `demo-user-${demoUsers.findIndex((candidate) => candidate.email === session.email) + 1}`,
        userEmail: user.email,
        userName: user.name,
        roles: [...user.roles],
        schoolId: user.schoolId ?? null,
        status:
          session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()
            ? "REVOKED"
            : "ONLINE",
        lastSeenAt: session.lastSeenAt ?? null,
        lastLoginAt: session.createdAt ?? null,
        lastLogoutAt: null,
        ipAddress: null,
        userAgent: "Modo JSON demo",
        createdAt: session.createdAt ?? null,
        updatedAt: session.lastSeenAt ?? session.createdAt ?? null,
      };
    })
    .filter(Boolean);
}

export function createJsonManagementProvider() {
  return {
    async init() {
      await mkdir(dataDir, { recursive: true });
    },
    async close() {},
    async listSchools(currentUser) {
      if (currentUser.roles.includes("ADMIN") || currentUser.roles.includes("FUNDACION")) {
        return DEMO_SCHOOLS.map(mapSchool);
      }

      return DEMO_SCHOOLS.filter((school) => school.id === currentUser.schoolId).map(mapSchool);
    },
    async listCycles() {
      const db = await readJsonFile(dbPath, { meta: { cycles: {} } });
      const cycleOverrides = isRecord(db?.meta?.cycles) ? db.meta.cycles : {};
      const cycles = new Map(
        DEFAULT_CYCLES.map((cycle) => [cycle.id, mapCycle(cycle, cycleOverrides[cycle.id])])
      );

      for (const cycleId of Object.keys(cycleOverrides)) {
        if (!cycles.has(cycleId)) {
          cycles.set(
            cycleId,
            mapCycle(
              {
                id: cycleId,
                name: `Ciclo ${cycleId}`,
                status: "OPEN",
                startsAt: null,
                endsAt: null,
                closedAt: null,
              },
              cycleOverrides[cycleId]
            )
          );
        }
      }

      return [...cycles.values()].sort((left, right) => right.id.localeCompare(left.id));
    },
    async listUsers() {
      return DEMO_AUTH_USERS.map(mapUser);
    },
    async createUser() {
      throw new Error("La administracion de usuarios requiere FNI_API_STORAGE=prisma.");
    },
    async updateUser() {
      throw new Error("La administracion de usuarios requiere FNI_API_STORAGE=prisma.");
    },
    async resetUserPassword() {
      throw new Error("La administracion de usuarios requiere FNI_API_STORAGE=prisma.");
    },
    async listSessions() {
      const sessionsDb = await readJsonFile(sessionsPath, { sessions: {} });
      const entries = Object.entries(sessionsDb.sessions ?? {});
      return mapSession(entries, DEMO_AUTH_USERS);
    },
    async listAudit() {
      return listJsonAuditEvents();
    },
  };
}
