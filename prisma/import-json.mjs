import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFoundationSchoolRows,
  defaultSubmissionRecord,
  DEFAULT_CYCLES,
  DEMO_SCHOOLS,
  isRecord,
  loadAreasSchema,
  normalizeWorkspaceSnapshot,
  toDateOrNull,
} from "../server/fni-domain.mjs";
import {
  getDocumentMeta,
  upsertDocumentFromBuffer,
} from "../server/fni-documents.mjs";
import { seedReferenceData } from "../server/fni-reference-data.mjs";
import { createPrismaClient } from "../server/prisma-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSourcePath = path.resolve(__dirname, "..", "server", ".data", "db.json");

function resolveSourcePath() {
  if (!process.argv[2]) {
    return defaultSourcePath;
  }

  return path.resolve(process.cwd(), process.argv[2]);
}

function parseWorkspaceKey(key) {
  const [schoolId, cycleId] = String(key).split("::");

  if (!schoolId || !cycleId) {
    throw new Error(`Workspace invalido en import JSON: ${key}`);
  }

  return { schoolId, cycleId };
}

function normalizeCatalogSchool(ref) {
  const knownSchool = DEMO_SCHOOLS.find((school) => school.id === ref.schoolId);

  return (
    knownSchool ?? {
      id: ref.schoolId,
      code: ref.schoolId.toUpperCase().slice(0, 12),
      name: `Colegio ${ref.schoolId}`,
      managerName: null,
      managerEmail: null,
    }
  );
}

function normalizeCatalogCycle(ref) {
  const knownCycle = DEFAULT_CYCLES.find((cycle) => cycle.id === ref.cycleId);

  return (
    knownCycle ?? {
      id: ref.cycleId,
      name: `Ciclo ${ref.cycleId}`,
      status: "OPEN",
      startsAt: null,
      endsAt: null,
      closedAt: null,
    }
  );
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

function extractInternalDocumentId(value) {
  if (!value || typeof value !== "string") return null;

  if (value.startsWith("doc:")) {
    return value.slice(4).trim() || null;
  }

  const match = value.match(/(?:^|\/)api\/fni\/documents\/([^/]+)\/download(?:$|\?)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function parsePdfDataUrl(value) {
  if (!value || typeof value !== "string") return null;

  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) {
    return null;
  }

  const mimeType = (match[1] ?? "application/octet-stream").toLowerCase();
  if (mimeType !== "application/pdf") {
    return null;
  }

  return {
    mimeType,
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function filePayloadToColumns(file, payload, warnings) {
  if (!file || typeof file !== "object") {
    return {
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
      fileStorageKey: null,
      uploadedAt: null,
    };
  }

  const internalDocumentId =
    (typeof file.id === "string" && file.id.trim() ? file.id.trim() : null) ??
    extractInternalDocumentId(file.downloadUrl) ??
    null;
  const existingDocument = internalDocumentId
    ? await getDocumentMeta(internalDocumentId)
    : null;

  if (existingDocument) {
    return {
      fileName:
        typeof file.name === "string" && file.name.trim() ? file.name : existingDocument.name,
      fileMimeType:
        typeof file.type === "string" && file.type.trim() ? file.type : existingDocument.type,
      fileSizeBytes:
        typeof file.size === "number"
          ? Math.max(0, Math.round(file.size))
          : existingDocument.size,
      fileStorageKey: `doc:${internalDocumentId}`,
      uploadedAt: toDateOrNull(file.uploadedAt) ?? toDateOrNull(existingDocument.uploadedAt),
    };
  }

  const parsedDataUrl = parsePdfDataUrl(file.dataUrl);

  if (parsedDataUrl) {
    const importedDocument = await upsertDocumentFromBuffer({
      documentId: internalDocumentId,
      schoolId: payload.schoolId,
      cycleId: payload.cycleId,
      indicatorId: payload.indicatorId,
      name:
        typeof file.name === "string" && file.name.trim() ? file.name : `${payload.indicatorId}.pdf`,
      type: typeof file.type === "string" && file.type.trim() ? file.type : parsedDataUrl.mimeType,
      uploadedAt:
        typeof file.uploadedAt === "string" && file.uploadedAt.trim()
          ? file.uploadedAt
          : new Date().toISOString(),
      uploadedByEmail: null,
      buffer: parsedDataUrl.buffer,
    });

    return {
      fileName: importedDocument.name,
      fileMimeType: importedDocument.type,
      fileSizeBytes: importedDocument.size,
      fileStorageKey: `doc:${importedDocument.id}`,
      uploadedAt: toDateOrNull(importedDocument.uploadedAt),
    };
  }

  const href = parseFileHref(file.downloadUrl);

  if (internalDocumentId && !href) {
    warnings.push(
      `No se encontro metadata ni PDF inline para el documento ${internalDocumentId} (${payload.schoolId}/${payload.cycleId}/${payload.indicatorId}).`
    );
  }

  return {
    fileName: typeof file.name === "string" ? file.name : null,
    fileMimeType: typeof file.type === "string" ? file.type : null,
    fileSizeBytes: typeof file.size === "number" ? Math.max(0, Math.round(file.size)) : null,
    fileStorageKey: href ?? (internalDocumentId ? `doc:${internalDocumentId}` : null),
    uploadedAt: toDateOrNull(file.uploadedAt),
  };
}

function submissionPayloadToDb(submission, lastActivityAt) {
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
      lastActivityAt,
  };
}

function collectLastActivityAt(snapshot) {
  const timestamps = [];

  for (const response of Object.values(snapshot.responses ?? {})) {
    if (response?.updatedAt) {
      timestamps.push(response.updatedAt);
    }

    if (response?.file?.uploadedAt) {
      timestamps.push(response.file.uploadedAt);
    }
  }

  for (const review of Object.values(snapshot.reviews ?? {})) {
    if (review?.reviewedAt) {
      timestamps.push(review.reviewedAt);
    }
  }

  if (snapshot.submission?.submittedAt) timestamps.push(snapshot.submission.submittedAt);
  if (snapshot.submission?.returnedAt) timestamps.push(snapshot.submission.returnedAt);
  if (snapshot.submission?.approvedAt) timestamps.push(snapshot.submission.approvedAt);

  if (!timestamps.length) {
    return null;
  }

  return toDateOrNull(timestamps.sort().at(-1));
}

async function loadJsonWorkspaces(sourcePath) {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  return isRecord(source.workspaces) ? source.workspaces : {};
}

async function ensureSchool(tx, ref) {
  const school = normalizeCatalogSchool(ref);

  await tx.school.upsert({
    where: { id: school.id },
    update: {
      code: school.code,
      name: school.name,
      managerName: school.managerName ?? null,
      managerEmail: school.managerEmail ?? null,
      status: "ACTIVE",
    },
    create: {
      id: school.id,
      code: school.code,
      name: school.name,
      managerName: school.managerName ?? null,
      managerEmail: school.managerEmail ?? null,
      status: "ACTIVE",
    },
  });

  return school;
}

async function ensureCycle(tx, ref) {
  const cycle = normalizeCatalogCycle(ref);

  await tx.cycle.upsert({
    where: { id: cycle.id },
    update: {
      name: cycle.name,
      status: cycle.status,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      closedAt: cycle.closedAt,
    },
    create: cycle,
  });
}

async function ensureWorkspace(tx, ref) {
  await ensureSchool(tx, ref);
  await ensureCycle(tx, ref);

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

async function replaceResponses(tx, ref, workspaceId, responses, warnings) {
  const entries = Object.entries(isRecord(responses) ? responses : {});
  const indicatorIds = entries.map(([indicatorId]) => indicatorId);

  if (indicatorIds.length) {
    await tx.indicatorResponse.deleteMany({
      where: {
        workspaceId,
        indicatorId: {
          notIn: indicatorIds,
        },
      },
    });
  } else {
    await tx.indicatorResponse.deleteMany({
      where: { workspaceId },
    });
  }

  for (const [indicatorId, response] of entries) {
    const payload = isRecord(response) ? response : {};
    const fileColumns = await filePayloadToColumns(
      payload.file,
      {
        schoolId: ref.schoolId,
        cycleId: ref.cycleId,
        indicatorId,
      },
      warnings
    );

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
        updatedAt: toDateOrNull(payload.updatedAt),
      },
      create: {
        workspaceId,
        indicatorId,
        answers: isRecord(payload.answers) ? payload.answers : {},
        documentRef: typeof payload.documentRef === "string" ? payload.documentRef : "",
        comments: typeof payload.comments === "string" ? payload.comments : "",
        ...fileColumns,
        updatedAt: toDateOrNull(payload.updatedAt),
      },
    });
  }

  return entries.length;
}

async function replaceReviews(tx, workspaceId, reviews) {
  const entries = Object.entries(isRecord(reviews) ? reviews : {});
  const indicatorIds = entries.map(([indicatorId]) => indicatorId);

  if (indicatorIds.length) {
    await tx.indicatorReview.deleteMany({
      where: {
        workspaceId,
        indicatorId: {
          notIn: indicatorIds,
        },
      },
    });
  } else {
    await tx.indicatorReview.deleteMany({
      where: { workspaceId },
    });
  }

  for (const [indicatorId, review] of entries) {
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
        reviewedAt: toDateOrNull(payload.reviewedAt),
      },
      create: {
        workspaceId,
        indicatorId,
        status: reviewStatusToDb(payload.status),
        reviewComment:
          typeof payload.reviewComment === "string" ? payload.reviewComment : "",
        reviewedAt: toDateOrNull(payload.reviewedAt),
      },
    });
  }

  return entries.length;
}

async function importWorkspace(tx, areasSchema, key, snapshot) {
  const ref = parseWorkspaceKey(key);
  const workspace = await ensureWorkspace(tx, ref);
  const school = normalizeCatalogSchool(ref);
  const lastActivityAt = collectLastActivityAt(snapshot);
  const warnings = [];
  const [foundationRow] = buildFoundationSchoolRows({
    schools: [school],
    cycleId: ref.cycleId,
    areasSchema,
    getWorkspaceSnapshot: () => snapshot,
  });

  const responseCount = await replaceResponses(
    tx,
    ref,
    workspace.id,
    snapshot.responses,
    warnings
  );
  const reviewCount = await replaceReviews(tx, workspace.id, snapshot.reviews);

  await tx.fniWorkspace.update({
    where: { id: workspace.id },
    data: {
      ...submissionPayloadToDb(snapshot.submission, lastActivityAt),
      reviewStatus: workspaceReviewStatusToDb(foundationRow?.status),
      lastActivityAt,
    },
  });

  return {
    responseCount,
    reviewCount,
    warnings,
  };
}

async function main() {
  const sourcePath = resolveSourcePath();
  const prisma = createPrismaClient();

  try {
    const referenceInfo = await seedReferenceData(prisma);
    const areasSchema = await loadAreasSchema();
    const workspaces = await loadJsonWorkspaces(sourcePath);
    let importedWorkspaces = 0;
    let importedResponses = 0;
    let importedReviews = 0;
    const warnings = [];

    for (const [key, rawSnapshot] of Object.entries(workspaces)) {
      const snapshot = normalizeWorkspaceSnapshot(rawSnapshot);
      const result = await prisma.$transaction((tx) =>
        importWorkspace(tx, areasSchema, key, snapshot)
      );

      importedWorkspaces += 1;
      importedResponses += result.responseCount;
      importedReviews += result.reviewCount;
      warnings.push(...result.warnings);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          sourcePath,
          areasSeeded: referenceInfo.areas,
          indicatorsSeeded: referenceInfo.indicators,
          importedWorkspaces,
          importedResponses,
          importedReviews,
          warnings,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error importando JSON local a PostgreSQL:", error);
  process.exit(1);
});
