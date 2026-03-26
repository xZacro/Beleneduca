import {
  buildFoundationSchoolRows,
  defaultSubmissionRecord,
  defaultWorkspace,
  DEMO_SCHOOLS,
  DEFAULT_CYCLES,
  isRecord,
  normalizeWorkspaceSnapshot,
  toDateOrNull,
  toIsoOrNull,
} from "./fni-domain.mjs";
import { buildDocumentDownloadUrl } from "./fni-documents.mjs";
import { seedReferenceData } from "./fni-reference-data.mjs";
import { createPrismaClient } from "./prisma-client.mjs";

// Persistencia Prisma: traduccion del mismo dominio sobre PostgreSQL.
function normalizeCatalogStatus(status) {
  return status === "INACTIVE" ? "inactive" : "active";
}

function reviewStatusToApi(status) {
  switch (status) {
    case "APROBADO":
      return "aprobado";
    case "OBSERVADO":
      return "observado";
    case "BLOQUEADO":
      return "bloqueado";
    default:
      return "pendiente";
  }
}

function reviewStatusToDb(status) {
  switch (status) {
    case "aprobado":
      return "APROBADO";
    case "observado":
      return "OBSERVADO";
    case "bloqueado":
      return "BLOQUEADO";
    default:
      return "PENDIENTE";
  }
}

function submissionStatusToApi(status) {
  switch (status) {
    case "ENVIADO":
      return "enviado";
    case "DEVUELTO":
      return "devuelto";
    case "APROBADO":
      return "aprobado";
    default:
      return "borrador";
  }
}

function submissionStatusToDb(status) {
  switch (status) {
    case "enviado":
      return "ENVIADO";
    case "devuelto":
      return "DEVUELTO";
    case "aprobado":
      return "APROBADO";
    default:
      return "BORRADOR";
  }
}

function workspaceReviewStatusToDb(status) {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "OBSERVED":
      return "OBSERVED";
    case "BLOCKED":
      return "BLOCKED";
    case "IN_REVIEW":
      return "IN_REVIEW";
    default:
      return "PENDING";
  }
}

function parseFileHref(value) {
  if (!value || typeof value !== "string") return null;
  return value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("/")
    ? value
    : null;
}

function parseDocumentIdFromStorageKey(value) {
  if (!value || typeof value !== "string" || !value.startsWith("doc:")) return null;
  return value.slice(4).trim() || null;
}

function filePayloadToColumns(file) {
  if (!file || typeof file !== "object") {
    return {
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
      fileStorageKey: null,
      uploadedAt: null,
    };
  }

  const href =
    parseFileHref(file.downloadUrl) ??
    parseFileHref(file.dataUrl) ??
    (typeof file.id === "string" && file.id.trim() ? `doc:${file.id.trim()}` : null);

  return {
    fileName: typeof file.name === "string" ? file.name : null,
    fileMimeType: typeof file.type === "string" ? file.type : null,
    fileSizeBytes: typeof file.size === "number" ? Math.max(0, Math.round(file.size)) : null,
    fileStorageKey: href,
    uploadedAt: toDateOrNull(file.uploadedAt),
  };
}

function mapResponseRowToApi(row) {
  const documentId = parseDocumentIdFromStorageKey(row.fileStorageKey);
  const file = row.fileName
    ? {
        id: documentId,
        name: row.fileName,
        type: row.fileMimeType ?? "application/pdf",
        size: row.fileSizeBytes ?? 0,
        uploadedAt:
          toIsoOrNull(row.uploadedAt) ??
          toIsoOrNull(row.updatedAt) ??
          new Date().toISOString(),
        downloadUrl:
          documentId != null
            ? buildDocumentDownloadUrl(documentId)
            : parseFileHref(row.fileStorageKey),
      }
    : null;

  return {
    answers: isRecord(row.answers) ? row.answers : {},
    documentRef: row.documentRef ?? "",
    comments: row.comments ?? "",
    file,
    updatedAt: toIsoOrNull(row.updatedAt),
  };
}

function mapReviewRowToApi(row) {
  return {
    status: reviewStatusToApi(row.status),
    reviewComment: row.reviewComment ?? "",
    reviewedAt: toIsoOrNull(row.reviewedAt),
    reviewedBy: row.reviewedBy?.email ?? null,
  };
}

function mapWorkspaceToSnapshot(workspace) {
  if (!workspace) return defaultWorkspace();

  const responses = Object.fromEntries(
    (workspace.responses ?? []).map((row) => [row.indicatorId, mapResponseRowToApi(row)])
  );

  const reviews = Object.fromEntries(
    (workspace.reviews ?? []).map((row) => [row.indicatorId, mapReviewRowToApi(row)])
  );

  return normalizeWorkspaceSnapshot({
    responses,
    reviews,
    submission: {
      status: submissionStatusToApi(workspace.submissionStatus),
      submittedAt: toIsoOrNull(workspace.submittedAt),
      returnedAt: toIsoOrNull(workspace.returnedAt),
      approvedAt: toIsoOrNull(workspace.approvedAt),
      message: workspace.message ?? "",
    },
  });
}

function mapAreaToCatalogDto(area) {
  return {
    id: area.id,
    code: area.code,
    name: area.name,
    order: area.sortOrder,
    status: normalizeCatalogStatus(area.status),
  };
}

function mapIndicatorToCatalogDto(indicator) {
  return {
    id: indicator.id,
    areaId: indicator.areaId,
    code: indicator.code,
    name: indicator.name,
    order: indicator.sortOrder,
    status: normalizeCatalogStatus(indicator.status),
  };
}

function normalizeAreaSchemasFromDb(areas) {
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    indicators: (area.indicators ?? []).map((indicator) => ({
      id: indicator.id,
      name: indicator.name,
      expectedPct: indicator.expectedPct,
      hasDocumentFields: Boolean(indicator.hasDocumentFields),
      questions: Array.isArray(indicator.questions) ? indicator.questions : [],
      visibleWhen: isRecord(indicator.visibleWhen) ? indicator.visibleWhen : undefined,
    })),
  }));
}

function mapManagementCycleDto(cycle, fallbackCycleId = null) {
  const cycleId = cycle?.id ?? fallbackCycleId ?? "";
  const closedAt = toIsoOrNull(cycle?.closedAt);
  const status = cycle?.status ?? (closedAt ? "CLOSED" : "OPEN");

  return {
    id: cycleId,
    name: cycle?.name ?? `Ciclo ${cycleId}`,
    status,
    startsAt: toIsoOrNull(cycle?.startsAt),
    endsAt: toIsoOrNull(cycle?.endsAt),
    closedAt,
    isClosed: Boolean(closedAt || status === "CLOSED"),
  };
}

function buildManagementDashboardSchools({ schools, cycleId, areas, workspaces }) {
  const workspaceByKey = new Map(
    workspaces.map((workspace) => [
      `${workspace.schoolId}::${workspace.cycleId}`,
      mapWorkspaceToSnapshot(workspace),
    ])
  );
  const workspaceBySchoolId = new Map(workspaces.map((workspace) => [workspace.schoolId, workspace]));

  return buildFoundationSchoolRows({
    schools,
    cycleId,
    areasSchema: normalizeAreaSchemasFromDb(areas),
    getWorkspaceSnapshot: (ref) =>
      workspaceByKey.get(`${ref.schoolId}::${ref.cycleId}`) ?? defaultWorkspace(),
  }).map((row) => {
    const workspace = workspaceBySchoolId.get(row.id);

    return {
      ...row,
      lastActivityAt: row.lastActivityAt ?? null,
      pendingCount: row.pendingCount ?? 0,
      observedCount: row.observedCount ?? 0,
      blockingCount: row.blockingCount ?? 0,
      missingEvidenceCount: row.missingEvidenceCount ?? 0,
      submitted: workspace?.submissionStatus != null ? workspace.submissionStatus !== "BORRADOR" : false,
    };
  });
}

function buildManagementDashboardIssues(workspaces) {
  return workspaces
    .flatMap((workspace) =>
      (workspace.reviews ?? [])
        .filter((review) => review.status === "OBSERVADO" || review.status === "BLOQUEADO")
        .map((review) => ({
          schoolId: workspace.schoolId,
          schoolCode: workspace.school?.code ?? workspace.schoolId,
          schoolName: workspace.school?.name ?? workspace.schoolId,
          indicatorId: review.indicatorId,
          indicatorCode: review.indicator?.code ?? review.indicatorId,
          indicatorName: review.indicator?.name ?? review.indicatorId,
          areaId: review.indicator?.areaId ?? null,
          areaName: review.indicator?.area?.name ?? null,
          reviewStatus: reviewStatusToApi(review.status),
          detail: review.reviewComment?.trim() || "Sin detalle registrado.",
          reviewedAt: toIsoOrNull(review.reviewedAt),
        }))
    )
    .sort((left, right) => {
      const leftTime = left.reviewedAt ? new Date(left.reviewedAt).getTime() : 0;
      const rightTime = right.reviewedAt ? new Date(right.reviewedAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

async function ensureSchool(tx, schoolId) {
  const existing = await tx.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });

  if (existing) return existing;

  const demoSchool = DEMO_SCHOOLS.find((school) => school.id === schoolId);
  if (!demoSchool) {
    throw new Error(`No existe un colegio conocido para schoolId=${schoolId}.`);
  }

  return tx.school.create({
    data: {
      id: demoSchool.id,
      code: demoSchool.code,
      name: demoSchool.name,
      managerName: demoSchool.managerName ?? null,
      managerEmail: demoSchool.managerEmail ?? null,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

async function ensureCycle(tx, cycleId) {
  const existing = await tx.cycle.findUnique({
    where: { id: cycleId },
    select: { id: true },
  });

  if (existing) return existing;

  const knownCycle = DEFAULT_CYCLES.find((cycle) => cycle.id === cycleId);
  return tx.cycle.create({
    data: knownCycle ?? {
      id: cycleId,
      name: `Ciclo ${cycleId}`,
      status: "OPEN",
      startsAt: null,
      endsAt: null,
      closedAt: null,
    },
    select: { id: true },
  });
}

async function getCycleOrThrow(tx, cycleId) {
  const cycle = await tx.cycle.findUnique({
    where: { id: cycleId },
  });

  if (!cycle) {
    throw new Error(`No se encontro el ciclo ${cycleId}.`);
  }

  return cycle;
}

async function ensureWorkspace(tx, ref) {
  await ensureSchool(tx, ref.schoolId);
  await ensureCycle(tx, ref.cycleId);

  return tx.fniWorkspace.upsert({
    where: {
      schoolId_cycleId: {
        schoolId: ref.schoolId,
        cycleId: ref.cycleId,
      },
    },
    update: {},
    create: {
      schoolId: ref.schoolId,
      cycleId: ref.cycleId,
      submissionStatus: "BORRADOR",
      reviewStatus: "PENDING",
      message: "",
    },
  });
}

async function refreshWorkspaceState(tx, workspaceId) {
  const workspace = await tx.fniWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      school: {
        select: {
          id: true,
          code: true,
          name: true,
          managerName: true,
          managerEmail: true,
        },
      },
      responses: true,
      reviews: {
        include: {
          reviewedBy: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!workspace || !workspace.school) return;

  const areas = await tx.area.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    include: {
      indicators: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const [row] = buildFoundationSchoolRows({
    schools: [workspace.school],
    cycleId: workspace.cycleId,
    areasSchema: normalizeAreaSchemasFromDb(areas),
    getWorkspaceSnapshot: () => mapWorkspaceToSnapshot(workspace),
  });

  await tx.fniWorkspace.update({
    where: { id: workspaceId },
    data: {
      reviewStatus: workspaceReviewStatusToDb(row?.status),
      lastActivityAt: toDateOrNull(row?.lastActivityAt) ?? new Date(),
    },
  });
}

async function replaceResponses(tx, workspaceId, responses) {
  const incomingEntries = Object.entries(isRecord(responses) ? responses : {});
  const incomingIds = incomingEntries.map(([indicatorId]) => indicatorId);

  if (incomingIds.length) {
    await tx.indicatorResponse.deleteMany({
      where: {
        workspaceId,
        indicatorId: {
          notIn: incomingIds,
        },
      },
    });
  } else {
    await tx.indicatorResponse.deleteMany({
      where: { workspaceId },
    });
  }

  for (const [indicatorId, response] of incomingEntries) {
    const payload = isRecord(response) ? response : {};
    const fileColumns = filePayloadToColumns(payload.file);

    await tx.indicatorResponse.upsert({
      where: {
        workspaceId_indicatorId: {
          workspaceId,
          indicatorId,
        },
      },
      update: {
        answers: isRecord(payload.answers) ? payload.answers : {},
        documentRef: typeof payload.documentRef === "string" ? payload.documentRef : "",
        comments: typeof payload.comments === "string" ? payload.comments : "",
        ...fileColumns,
        updatedAt: toDateOrNull(payload.updatedAt) ?? new Date(),
      },
      create: {
        workspaceId,
        indicatorId,
        answers: isRecord(payload.answers) ? payload.answers : {},
        documentRef: typeof payload.documentRef === "string" ? payload.documentRef : "",
        comments: typeof payload.comments === "string" ? payload.comments : "",
        ...fileColumns,
        updatedAt: toDateOrNull(payload.updatedAt) ?? new Date(),
      },
    });
  }
}

async function replaceReviews(tx, workspaceId, reviews) {
  const incomingEntries = Object.entries(isRecord(reviews) ? reviews : {});
  const incomingIds = incomingEntries.map(([indicatorId]) => indicatorId);

  if (incomingIds.length) {
    await tx.indicatorReview.deleteMany({
      where: {
        workspaceId,
        indicatorId: {
          notIn: incomingIds,
        },
      },
    });
  } else {
    await tx.indicatorReview.deleteMany({
      where: { workspaceId },
    });
  }

  for (const [indicatorId, review] of incomingEntries) {
    const payload = isRecord(review) ? review : {};

    await tx.indicatorReview.upsert({
      where: {
        workspaceId_indicatorId: {
          workspaceId,
          indicatorId,
        },
      },
      update: {
        status: reviewStatusToDb(payload.status),
        reviewComment:
          typeof payload.reviewComment === "string" ? payload.reviewComment : "",
        reviewedAt: toDateOrNull(payload.reviewedAt) ?? null,
      },
      create: {
        workspaceId,
        indicatorId,
        status: reviewStatusToDb(payload.status),
        reviewComment:
          typeof payload.reviewComment === "string" ? payload.reviewComment : "",
        reviewedAt: toDateOrNull(payload.reviewedAt) ?? null,
      },
    });
  }
}

function submissionPayloadToDb(submission) {
  const normalized = {
    ...defaultSubmissionRecord(),
    ...(isRecord(submission) ? submission : {}),
  };

  return {
    submissionStatus: submissionStatusToDb(normalized.status),
    submittedAt: toDateOrNull(normalized.submittedAt),
    returnedAt: toDateOrNull(normalized.returnedAt),
    approvedAt: toDateOrNull(normalized.approvedAt),
    message: typeof normalized.message === "string" ? normalized.message : "",
    lastActivityAt:
      toDateOrNull(normalized.approvedAt) ??
      toDateOrNull(normalized.returnedAt) ??
      toDateOrNull(normalized.submittedAt) ??
      new Date(),
  };
}

function buildIndicatorWhere(filters) {
  const where = {};
  const q = filters.q?.trim();
  const status =
    filters.status === "active"
      ? "ACTIVE"
      : filters.status === "inactive"
      ? "INACTIVE"
      : null;

  if (filters.areaId) {
    where.areaId = filters.areaId;
  }

  if (status) {
    where.status = status;
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

async function seedPrismaCatalog() {
  const prisma = createPrismaClient();

  try {
    const referenceInfo = await seedReferenceData(prisma);

    let createdWorkspaces = 0;

    await prisma.$transaction(async (tx) => {
      for (const school of DEMO_SCHOOLS) {
        for (const cycle of DEFAULT_CYCLES) {
          const existing = await tx.fniWorkspace.findUnique({
            where: {
              schoolId_cycleId: {
                schoolId: school.id,
                cycleId: cycle.id,
              },
            },
            select: { id: true },
          });

          if (!existing) {
            createdWorkspaces += 1;
          }

          await tx.fniWorkspace.upsert({
            where: {
              schoolId_cycleId: {
                schoolId: school.id,
                cycleId: cycle.id,
              },
            },
            update: {},
            create: {
              schoolId: school.id,
              cycleId: cycle.id,
              submissionStatus: "BORRADOR",
              reviewStatus: "PENDING",
              message: "",
            },
          });
        }
      }
    });

    return {
      ok: true,
      areas: referenceInfo.areas,
      indicators: referenceInfo.indicators,
      workspaces: createdWorkspaces,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export function createPrismaStorage() {
  let prisma;

  function getClient() {
    if (!prisma) {
      prisma = createPrismaClient();
    }

    return prisma;
  }

  return {
    // Prisma implementa el mismo contrato de storage que el modo JSON.
    mode: "prisma",
    description: "PostgreSQL via Prisma",
    async init() {
      await getClient().$connect();
    },
    async checkReadiness() {
      const prisma = getClient();
      await prisma.$queryRaw`SELECT 1`;

      const [schoolCount, cycleCount, workspaceCount] = await Promise.all([
        prisma.school.count(),
        prisma.cycle.count(),
        prisma.fniWorkspace.count(),
      ]);

      return {
        ok: true,
        mode: "prisma",
        database: "reachable",
        schoolCount,
        cycleCount,
        workspaceCount,
      };
    },
    async close() {
      if (prisma) {
        await prisma.$disconnect();
      }
    },
    async getWorkspace(ref) {
      const prisma = getClient();
      const workspace = await prisma.fniWorkspace.findUnique({
        where: {
          schoolId_cycleId: {
            schoolId: ref.schoolId,
            cycleId: ref.cycleId,
          },
        },
        include: {
          responses: true,
          reviews: {
            include: {
              reviewedBy: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      });

      return mapWorkspaceToSnapshot(workspace);
    },
    async saveResponses(ref, responses) {
      const prisma = getClient();
      await prisma.$transaction(async (tx) => {
        const workspace = await ensureWorkspace(tx, ref);
        await replaceResponses(tx, workspace.id, responses);
        await refreshWorkspaceState(tx, workspace.id);
      });
    },
    async saveReviews(ref, reviews) {
      const prisma = getClient();
      await prisma.$transaction(async (tx) => {
        const workspace = await ensureWorkspace(tx, ref);
        await replaceReviews(tx, workspace.id, reviews);
        await refreshWorkspaceState(tx, workspace.id);
      });
    },
    async saveSubmission(ref, submission) {
      const prisma = getClient();
      await prisma.$transaction(async (tx) => {
        const workspace = await ensureWorkspace(tx, ref);
        await tx.fniWorkspace.update({
          where: { id: workspace.id },
          data: submissionPayloadToDb(submission),
        });
        await refreshWorkspaceState(tx, workspace.id);
      });
    },
    async listFoundationSchools(cycleId) {
      const prisma = getClient();
      const [schools, areas, workspaces] = await Promise.all([
        prisma.school.findMany({
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            managerName: true,
            managerEmail: true,
          },
        }),
        prisma.area.findMany({
          where: { status: "ACTIVE" },
          orderBy: { sortOrder: "asc" },
          include: {
            indicators: {
              where: { status: "ACTIVE" },
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
        prisma.fniWorkspace.findMany({
          where: { cycleId },
          include: {
            responses: true,
            reviews: {
              include: {
                reviewedBy: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const workspaceByKey = new Map(
        workspaces.map((workspace) => [
          `${workspace.schoolId}::${workspace.cycleId}`,
          mapWorkspaceToSnapshot(workspace),
        ])
      );

      return buildFoundationSchoolRows({
        schools,
        cycleId,
        areasSchema: normalizeAreaSchemasFromDb(areas),
        getWorkspaceSnapshot: (ref) =>
          workspaceByKey.get(`${ref.schoolId}::${ref.cycleId}`) ?? defaultWorkspace(),
      });
    },
    async getManagementDashboard(cycleId) {
      const prisma = getClient();
      const [cycle, schools, areas, workspaces] = await Promise.all([
        prisma.cycle.findUnique({
          where: { id: cycleId },
        }),
        prisma.school.findMany({
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            managerName: true,
            managerEmail: true,
          },
        }),
        prisma.area.findMany({
          where: { status: "ACTIVE" },
          orderBy: { sortOrder: "asc" },
          include: {
            indicators: {
              where: { status: "ACTIVE" },
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
        prisma.fniWorkspace.findMany({
          where: { cycleId },
          include: {
            school: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            responses: true,
            reviews: {
              include: {
                reviewedBy: {
                  select: {
                    email: true,
                  },
                },
                indicator: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    areaId: true,
                    area: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        cycle: mapManagementCycleDto(cycle, cycleId),
        schools: buildManagementDashboardSchools({
          schools,
          cycleId,
          areas,
          workspaces,
        }),
        issues: buildManagementDashboardIssues(workspaces),
      };
    },
    async createCycle(payload) {
      const prisma = getClient();
      const existing = await prisma.cycle.findUnique({
        where: { id: payload.id },
        select: { id: true },
      });

      if (existing) {
        throw new Error(`Ya existe un ciclo con id ${payload.id}.`);
      }

      const cycle = await prisma.cycle.create({
        data: {
          id: payload.id,
          name: payload.name,
          status: "OPEN",
          startsAt: toDateOrNull(payload.startsAt),
          endsAt: toDateOrNull(payload.endsAt),
          closedAt: null,
        },
      });

      return mapManagementCycleDto(cycle, payload.id);
    },
    async updateCycle(cycleId, payload) {
      const prisma = getClient();
      await getCycleOrThrow(prisma, cycleId);

      const cycle = await prisma.cycle.update({
        where: { id: cycleId },
        data: {
          name: payload.name,
          startsAt: toDateOrNull(payload.startsAt),
          endsAt: toDateOrNull(payload.endsAt),
        },
      });

      return mapManagementCycleDto(cycle, cycleId);
    },
    async closeCycle(cycleId) {
      const prisma = getClient();
      const existing = await prisma.cycle.findUnique({
        where: { id: cycleId },
      });
      const closedAt = existing?.closedAt ?? new Date();

      const cycle = await prisma.cycle.upsert({
        where: { id: cycleId },
        update: {
          status: "CLOSED",
          closedAt,
        },
        create: {
          id: cycleId,
          name: `Ciclo ${cycleId}`,
          status: "CLOSED",
          startsAt: null,
          endsAt: null,
          closedAt,
        },
      });

      return mapManagementCycleDto(cycle, cycleId);
    },
    async reopenCycle(cycleId) {
      const prisma = getClient();
      await getCycleOrThrow(prisma, cycleId);

      const cycle = await prisma.cycle.update({
        where: { id: cycleId },
        data: {
          status: "OPEN",
          closedAt: null,
        },
      });

      return mapManagementCycleDto(cycle, cycleId);
    },
    async listAreas() {
      const prisma = getClient();
      const areas = await prisma.area.findMany({
        orderBy: { sortOrder: "asc" },
      });

      return areas.map(mapAreaToCatalogDto);
    },
    async listIndicators(filters = {}) {
      const prisma = getClient();
      const indicators = await prisma.indicator.findMany({
        where: buildIndicatorWhere(filters),
        orderBy: [{ areaId: "asc" }, { sortOrder: "asc" }],
      });

      return indicators.map(mapIndicatorToCatalogDto);
    },
    async getIndicator(indicatorId) {
      const prisma = getClient();
      const indicator = await prisma.indicator.findUnique({
        where: { id: indicatorId },
      });

      return indicator ? mapIndicatorToCatalogDto(indicator) : null;
    },
    async updateIndicator(indicatorId, payload) {
      const prisma = getClient();
      const existing = await prisma.indicator.findUnique({
        where: { id: indicatorId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error(`No se encontro el indicador ${indicatorId}.`);
      }

      const indicator = await prisma.indicator.update({
        where: { id: indicatorId },
        data: {
          name: payload.name,
          sortOrder: payload.order,
          status: payload.status === "inactive" ? "INACTIVE" : "ACTIVE",
        },
      });

      return mapIndicatorToCatalogDto(indicator);
    },
    async seedCatalog() {
      return seedPrismaCatalog();
    },
  };
}
