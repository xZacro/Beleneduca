import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCatalogAreaDtosFromSchema,
  buildCatalogIndicatorDtosFromSchema,
  buildFoundationSchoolRows,
  DEMO_SCHOOLS,
  DEFAULT_CYCLES,
  loadAreasSchema,
  normalizeWorkspaceSnapshot,
  defaultSubmissionRecord,
  isRecord,
} from "./fni-domain.mjs";
import { resolveApiDataDir } from "./fni-data-dir.mjs";

// Persistencia JSON: pensada para desarrollo local y pruebas sin base externa.
const dataDir = resolveApiDataDir();
const dbPath = path.join(dataDir, "db.json");

function defaultDb() {
  return {
    workspaces: {},
    meta: {
      cycles: {},
      catalogIndicators: {},
      seededAt: null,
      updatedAt: null,
    },
  };
}

function workspaceKey({ schoolId, cycleId }) {
  return `${schoolId}::${cycleId}`;
}

async function ensureDbFile() {
  try {
    await access(dbPath);
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dbPath, `${JSON.stringify(defaultDb(), null, 2)}\n`, "utf8");
  }
}

async function readDb() {
  await ensureDbFile();

  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...defaultDb(),
      ...parsed,
      workspaces: isRecord(parsed.workspaces) ? parsed.workspaces : {},
      meta: {
        ...defaultDb().meta,
        ...(isRecord(parsed.meta) ? parsed.meta : {}),
      },
    };
  } catch {
    return defaultDb();
  }
}

let writeQueue = Promise.resolve();

function updateDb(mutator) {
  const nextWrite = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    db.meta.updatedAt = new Date().toISOString();
    await mkdir(dataDir, { recursive: true });
    await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return result;
  });

  writeQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

function getWorkspaceSnapshot(db, ref) {
  const key = workspaceKey(ref);
  return normalizeWorkspaceSnapshot(db.workspaces[key]);
}

function setWorkspaceSnapshot(db, ref, snapshotPatch) {
  const key = workspaceKey(ref);
  const current = getWorkspaceSnapshot(db, ref);

  db.workspaces[key] = {
    ...current,
    ...snapshotPatch,
  };

  return normalizeWorkspaceSnapshot(db.workspaces[key]);
}

function getCycleMetaStore(db) {
  if (!isRecord(db.meta.cycles)) {
    db.meta.cycles = {};
  }

  return db.meta.cycles;
}

function getCatalogIndicatorMetaStore(db) {
  if (!isRecord(db.meta.catalogIndicators)) {
    db.meta.catalogIndicators = {};
  }

  return db.meta.catalogIndicators;
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function hasKnownCycle(cycleId) {
  return DEFAULT_CYCLES.some((cycle) => cycle.id === cycleId);
}

function cycleExists(db, cycleId) {
  const cycles = getCycleMetaStore(db);
  return hasKnownCycle(cycleId) || isRecord(cycles[cycleId]);
}

function getCycleSnapshot(db, cycleId) {
  const knownCycle = DEFAULT_CYCLES.find((cycle) => cycle.id === cycleId);
  const overrides = getCycleMetaStore(db)[cycleId];
  const name =
    typeof overrides?.name === "string" && overrides.name.trim()
      ? overrides.name
      : knownCycle?.name ?? `Ciclo ${cycleId}`;
  const startsAt = hasOwn(overrides, "startsAt")
    ? overrides.startsAt ?? null
    : knownCycle?.startsAt?.toISOString?.() ?? null;
  const endsAt = hasOwn(overrides, "endsAt")
    ? overrides.endsAt ?? null
    : knownCycle?.endsAt?.toISOString?.() ?? null;
  const closedAt = hasOwn(overrides, "closedAt")
    ? overrides.closedAt ?? null
    : knownCycle?.closedAt?.toISOString?.() ?? null;
  const baseStatus =
    typeof overrides?.status === "string" ? overrides.status : knownCycle?.status ?? "OPEN";
  const status = closedAt ? "CLOSED" : baseStatus === "ARCHIVED" ? "ARCHIVED" : "OPEN";

  return {
    id: cycleId,
    name,
    status,
    startsAt,
    endsAt,
    closedAt,
    isClosed: Boolean(closedAt || status === "CLOSED"),
  };
}

function saveCycleSnapshot(db, cycleId, patch) {
  const cycles = getCycleMetaStore(db);
  const current = getCycleSnapshot(db, cycleId);

  cycles[cycleId] = {
    ...(isRecord(cycles[cycleId]) ? cycles[cycleId] : {}),
    name: patch.name ?? current.name,
    status: patch.status ?? current.status,
    startsAt: patch.startsAt === undefined ? current.startsAt : patch.startsAt,
    endsAt: patch.endsAt === undefined ? current.endsAt : patch.endsAt,
    closedAt: patch.closedAt === undefined ? current.closedAt : patch.closedAt,
  };

  return getCycleSnapshot(db, cycleId);
}

function buildDashboardIssues({ areasSchema, cycleId, getWorkspaceSnapshot }) {
  const areaById = new Map(areasSchema.map((area) => [area.id, area]));
  const indicatorById = new Map(
    buildCatalogIndicatorDtosFromSchema(areasSchema).map((indicator) => [indicator.id, indicator])
  );
  const schoolById = new Map(DEMO_SCHOOLS.map((school) => [school.id, school]));

  return DEMO_SCHOOLS.flatMap((school) => {
    const workspace = getWorkspaceSnapshot({ schoolId: school.id, cycleId });

    return Object.entries(workspace.reviews ?? {})
      .filter(([, review]) => review?.status === "observado" || review?.status === "bloqueado")
      .map(([indicatorId, review]) => {
        const indicator = indicatorById.get(indicatorId);
        const area = indicator ? areaById.get(indicator.areaId) : null;
        const schoolInfo = schoolById.get(school.id);

        return {
          schoolId: school.id,
          schoolCode: schoolInfo?.code ?? school.id,
          schoolName: schoolInfo?.name ?? school.id,
          indicatorId,
          indicatorCode: indicator?.code ?? indicatorId,
          indicatorName: indicator?.name ?? indicatorId,
          areaId: indicator?.areaId ?? null,
          areaName: area?.name ?? null,
          reviewStatus: review.status,
          detail: review.reviewComment?.trim() || "Sin detalle registrado.",
          reviewedAt: review.reviewedAt ?? null,
        };
      });
  }).sort((left, right) => {
    const leftTime = left.reviewedAt ? new Date(left.reviewedAt).getTime() : 0;
    const rightTime = right.reviewedAt ? new Date(right.reviewedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function buildCatalogIndicatorMap(areasSchema) {
  return new Map(buildCatalogIndicatorDtosFromSchema(areasSchema).map((indicator) => [indicator.id, indicator]));
}

function mergeCatalogIndicator(baseIndicator, override) {
  if (!baseIndicator) return null;

  if (!isRecord(override)) {
    return baseIndicator;
  }

  return {
    ...baseIndicator,
    ...(typeof override.name === "string" && override.name.trim() ? { name: override.name.trim() } : {}),
    ...(typeof override.order === "number" ? { order: override.order } : {}),
    ...(override.status === "active" || override.status === "inactive" ? { status: override.status } : {}),
  };
}

export function createJsonStorage() {
  return {
    // El modo JSON expone la misma superficie que Prisma para no tocar el frontend.
    mode: "json",
    description: dbPath,
    async init() {
      await ensureDbFile();
    },
    async checkReadiness() {
      const db = await readDb();
      return {
        ok: true,
        mode: "json",
        dataFile: dbPath,
        workspaceCount: Object.keys(db.workspaces ?? {}).length,
        updatedAt: db.meta.updatedAt ?? null,
      };
    },
    async close() {},
    async getWorkspace(ref) {
      const db = await readDb();
      return getWorkspaceSnapshot(db, ref);
    },
    async saveResponses(ref, responses) {
      await updateDb((db) => {
        setWorkspaceSnapshot(db, ref, { responses });
      });
    },
    async saveReviews(ref, reviews) {
      await updateDb((db) => {
        setWorkspaceSnapshot(db, ref, { reviews });
      });
    },
    async saveSubmission(ref, submission) {
      await updateDb((db) => {
        setWorkspaceSnapshot(db, ref, {
          submission: {
            ...defaultSubmissionRecord(),
            ...submission,
          },
        });
      });
    },
    async listFoundationSchools(cycleId) {
      const [areasSchema, db] = await Promise.all([loadAreasSchema(), readDb()]);

      return buildFoundationSchoolRows({
        cycleId,
        areasSchema,
        getWorkspaceSnapshot: (ref) => getWorkspaceSnapshot(db, ref),
      });
    },
    async getManagementDashboard(cycleId) {
      const [areasSchema, db] = await Promise.all([loadAreasSchema(), readDb()]);
      const schools = buildFoundationSchoolRows({
        cycleId,
        areasSchema,
        getWorkspaceSnapshot: (ref) => getWorkspaceSnapshot(db, ref),
      }).map((row) => {
        const workspace = getWorkspaceSnapshot(db, { schoolId: row.id, cycleId });

        return {
          ...row,
          lastActivityAt: row.lastActivityAt ?? null,
          pendingCount: row.pendingCount ?? 0,
          observedCount: row.observedCount ?? 0,
          blockingCount: row.blockingCount ?? 0,
          missingEvidenceCount: row.missingEvidenceCount ?? 0,
          submitted: workspace.submission.status !== "borrador",
        };
      });

      return {
        cycle: getCycleSnapshot(db, cycleId),
        schools,
        issues: buildDashboardIssues({
          areasSchema,
          cycleId,
          getWorkspaceSnapshot: (ref) => getWorkspaceSnapshot(db, ref),
        }),
      };
    },
    async createCycle(payload) {
      return updateDb((db) => {
        if (cycleExists(db, payload.id)) {
          throw new Error(`Ya existe un ciclo con id ${payload.id}.`);
        }

        return saveCycleSnapshot(db, payload.id, {
          name: payload.name,
          status: "OPEN",
          startsAt: payload.startsAt ?? null,
          endsAt: payload.endsAt ?? null,
          closedAt: null,
        });
      });
    },
    async updateCycle(cycleId, payload) {
      return updateDb((db) => {
        if (!cycleExists(db, cycleId)) {
          throw new Error(`No se encontro el ciclo ${cycleId}.`);
        }

        return saveCycleSnapshot(db, cycleId, {
          name: payload.name,
          startsAt: payload.startsAt ?? null,
          endsAt: payload.endsAt ?? null,
        });
      });
    },
    async closeCycle(cycleId) {
      return updateDb((db) => {
        return saveCycleSnapshot(db, cycleId, {
          status: "CLOSED",
          closedAt: new Date().toISOString(),
        });
      });
    },
    async reopenCycle(cycleId) {
      return updateDb((db) => {
        if (!cycleExists(db, cycleId)) {
          throw new Error(`No se encontro el ciclo ${cycleId}.`);
        }

        return saveCycleSnapshot(db, cycleId, {
          status: "OPEN",
          closedAt: null,
        });
      });
    },
    async listAreas() {
      const areasSchema = await loadAreasSchema();
      return buildCatalogAreaDtosFromSchema(areasSchema);
    },
    async listIndicators(filters = {}) {
      const areasSchema = await loadAreasSchema();
      const rows = buildCatalogIndicatorDtosFromSchema(areasSchema);
      const overrides = getCatalogIndicatorMetaStore(await readDb());
      const q = filters.q?.trim().toLowerCase() ?? "";

      return rows
        .map((indicator) => mergeCatalogIndicator(indicator, overrides[indicator.id]) ?? indicator)
        .filter((indicator) => {
        if (filters.areaId && indicator.areaId !== filters.areaId) return false;
        if (filters.status && filters.status !== "all" && indicator.status !== filters.status) return false;
        if (!q) return true;

        return (
          indicator.name.toLowerCase().includes(q) ||
          indicator.code.toLowerCase().includes(q) ||
          indicator.id.toLowerCase().includes(q)
        );
        })
        .sort((left, right) => {
          const areaCompare = left.areaId.localeCompare(right.areaId);
          if (areaCompare !== 0) return areaCompare;
          return left.order - right.order;
        });
    },
    async getIndicator(indicatorId) {
      const areasSchema = await loadAreasSchema();
      const indicators = buildCatalogIndicatorDtosFromSchema(areasSchema);
      const overrides = getCatalogIndicatorMetaStore(await readDb());
      const baseIndicator = indicators.find((row) => row.id === indicatorId) ?? null;
      return mergeCatalogIndicator(baseIndicator, overrides[indicatorId]);
    },
    async updateIndicator(indicatorId, payload) {
      const areasSchema = await loadAreasSchema();
      const baseIndicator = buildCatalogIndicatorMap(areasSchema).get(indicatorId);

      if (!baseIndicator) {
        throw new Error(`No se encontro el indicador ${indicatorId}.`);
      }

      return updateDb((db) => {
        const catalogIndicators = getCatalogIndicatorMetaStore(db);
        catalogIndicators[indicatorId] = {
          ...(isRecord(catalogIndicators[indicatorId]) ? catalogIndicators[indicatorId] : {}),
          name: payload.name,
          order: payload.order,
          status: payload.status,
        };

        return mergeCatalogIndicator(baseIndicator, catalogIndicators[indicatorId]);
      });
    },
    async seedCatalog() {
      const areasSchema = await loadAreasSchema();
      const indicators = buildCatalogIndicatorDtosFromSchema(areasSchema);
      const cycles = ["2025", "2026"];

      const createdWorkspaces = await updateDb((db) => {
        let created = 0;

        for (const school of DEMO_SCHOOLS) {
          for (const cycleId of cycles) {
            const key = workspaceKey({ schoolId: school.id, cycleId });
            if (!db.workspaces[key]) {
              db.workspaces[key] = normalizeWorkspaceSnapshot({});
              created += 1;
            }
          }
        }

        db.meta.seededAt = new Date().toISOString();
        return created;
      });

      return {
        ok: true,
        areas: areasSchema.length,
        indicators: indicators.length,
        workspaces: createdWorkspaces,
      };
    },
  };
}
