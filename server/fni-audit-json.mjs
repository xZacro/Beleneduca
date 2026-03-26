import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveApiDataDir } from "./fni-data-dir.mjs";

const dataDir = resolveApiDataDir();
const auditPath = path.join(dataDir, "audit.json");
const MAX_STORED_EVENTS = 500;

let writeQueue = Promise.resolve();

function defaultAuditDb() {
  return {
    events: [],
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEvent(value) {
  if (!isRecord(value)) return null;

  return {
    id: typeof value.id === "string" ? value.id : randomUUID(),
    type: typeof value.type === "string" ? value.type : "CHANGE",
    at: typeof value.at === "string" ? value.at : new Date().toISOString(),
    actorUserId: typeof value.actorUserId === "string" ? value.actorUserId : null,
    actorName: typeof value.actorName === "string" ? value.actorName : "Sistema",
    actorEmail: typeof value.actorEmail === "string" ? value.actorEmail : "system@local",
    actorSchoolId: typeof value.actorSchoolId === "string" ? value.actorSchoolId : null,
    actorRoles: Array.isArray(value.actorRoles) ? value.actorRoles.filter((item) => typeof item === "string") : [],
    meta: isRecord(value.meta) ? value.meta : null,
  };
}

async function ensureAuditFile() {
  try {
    await access(auditPath);
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(defaultAuditDb(), null, 2)}\n`, "utf8");
  }
}

async function readAuditDb() {
  await ensureAuditFile();

  try {
    const raw = await readFile(auditPath, "utf8");
    const parsed = JSON.parse(raw);
    const events = Array.isArray(parsed.events)
      ? parsed.events.map(normalizeEvent).filter(Boolean)
      : [];

    return { events };
  } catch {
    return defaultAuditDb();
  }
}

function updateAuditDb(mutator) {
  const nextWrite = writeQueue.then(async () => {
    const db = await readAuditDb();
    const result = await mutator(db);
    db.events = db.events.slice(0, MAX_STORED_EVENTS);
    await mkdir(dataDir, { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return result;
  });

  writeQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

function buildAuditEvent(type, actor, meta = null) {
  return {
    id: randomUUID(),
    type,
    at: new Date().toISOString(),
    actorUserId: null,
    actorName:
      typeof actor?.name === "string" && actor.name.trim() ? actor.name.trim() : "Sistema",
    actorEmail:
      typeof actor?.email === "string" && actor.email.trim()
        ? actor.email.trim().toLowerCase()
        : "system@local",
    actorSchoolId:
      typeof actor?.schoolId === "string" && actor.schoolId.trim() ? actor.schoolId.trim() : null,
    actorRoles: Array.isArray(actor?.roles)
      ? actor.roles.filter((role) => typeof role === "string")
      : [],
    meta: isRecord(meta) ? meta : null,
  };
}

export async function initJsonAuditStore() {
  await ensureAuditFile();
}

export async function recordJsonAuditEvent(type, actor, meta = null) {
  const event = buildAuditEvent(type, actor, meta);

  await updateAuditDb((db) => {
    db.events.unshift(event);
  });

  return event;
}

export async function listJsonAuditEvents() {
  const db = await readAuditDb();
  return db.events
    .map(normalizeEvent)
    .filter(Boolean)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 200);
}
