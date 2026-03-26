import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const schemaPath = path.join(rootDir, "src", "shared", "fni", "schema", "evaluacionSchema.ts");

// Dominio compartido entre JSON y Prisma: catalogo, ciclos, workspaces y calculos.
export const DEMO_SCHOOLS = [
  {
    id: "sch_1",
    code: "CACE",
    name: "Colegio A. C. E.",
    managerName: "Encargado/a",
    managerEmail: "encargado.cace@colegio.cl",
  },
  { id: "sch_2", code: "CAMV", name: "Colegio A. M. V." },
  { id: "sch_3", code: "CCOC", name: "Colegio C. O. C." },
  {
    id: "sch_4",
    code: "CJFF",
    name: "Colegio J. F. F.",
    managerName: "Encargado/a",
    managerEmail: "encargado.cjff@colegio.cl",
  },
  { id: "sch_5", code: "CJLU", name: "Colegio J. L. U." },
  { id: "sch_6", code: "CJMC", name: "Colegio J. M. C." },
  {
    id: "sch_7",
    code: "CLSM",
    name: "Colegio L. S. M.",
    managerName: "Encargado/a",
    managerEmail: "encargado.clsm@colegio.cl",
  },
  { id: "sch_8", code: "CPDM", name: "Colegio P. D. M." },
  { id: "sch_9", code: "CRSH", name: "Colegio R. S. H." },
  {
    id: "sch_10",
    code: "CSAH",
    name: "Colegio S. A. H.",
    managerName: "Encargado/a",
    managerEmail: "encargado.csah@colegio.cl",
  },
  { id: "sch_11", code: "CSDM", name: "Colegio S. D. M." },
  { id: "sch_12", code: "CSFA", name: "Colegio S. F. A." },
];

export const DEFAULT_CYCLES = [
  {
    id: "2025",
    name: "Ciclo 2025",
    status: "CLOSED",
    startsAt: new Date("2025-01-01T00:00:00.000Z"),
    endsAt: new Date("2025-12-31T23:59:59.000Z"),
    closedAt: new Date("2025-12-31T23:59:59.000Z"),
  },
  {
    id: "2026",
    name: "Ciclo 2026",
    status: "OPEN",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-31T23:59:59.000Z"),
    closedAt: null,
  },
];

let schemaCachePromise;

export function defaultSubmissionRecord() {
  return {
    status: "borrador",
    submittedAt: null,
    returnedAt: null,
    approvedAt: null,
    message: "",
  };
}

export function defaultWorkspace() {
  return {
    responses: {},
    reviews: {},
    submission: defaultSubmissionRecord(),
  };
}

export function defaultIndicatorResponse() {
  return {
    answers: {},
    documentRef: "",
    comments: "",
    file: null,
    updatedAt: null,
  };
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Garantiza la forma minima de un workspace para que el resto del dominio no
 * tenga que verificar nulos en cada acceso.
 */
export function normalizeWorkspaceSnapshot(value) {
  if (!isRecord(value)) return defaultWorkspace();

  return {
    responses: isRecord(value.responses) ? value.responses : {},
    reviews: isRecord(value.reviews) ? value.reviews : {},
    submission: isRecord(value.submission)
      ? {
          ...defaultSubmissionRecord(),
          ...value.submission,
        }
      : defaultSubmissionRecord(),
  };
}

// Extrae el contexto de trabajo que usa casi toda la API FNI.
export function parseWorkspaceRef(searchParams) {
  const schoolId = searchParams.get("schoolId");
  const cycleId = searchParams.get("cycleId");

  if (!schoolId || !cycleId) return null;
  return { schoolId, cycleId };
}

function extractAreasLiteral(source) {
  const exportToken = "export const AREAS_SCHEMA";
  const exportIndex = source.indexOf(exportToken);
  if (exportIndex === -1) {
    throw new Error("No se encontro AREAS_SCHEMA en evaluacionSchema.ts.");
  }

  const equalsIndex = source.indexOf("=", exportIndex);
  if (equalsIndex === -1) {
    throw new Error("No se pudo ubicar la asignacion de AREAS_SCHEMA.");
  }

  const arrayStart = source.indexOf("[", equalsIndex);
  if (arrayStart === -1) {
    throw new Error("No se pudo ubicar el inicio del array AREAS_SCHEMA.");
  }

  let depth = 0;
  let stringQuote = null;
  let escaped = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (stringQuote) {
      if (!escaped && char === stringQuote) {
        stringQuote = null;
      }
      escaped = !escaped && char === "\\";
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      escaped = false;
      continue;
    }

    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;

    if (depth === 0) {
      return source.slice(arrayStart, index + 1);
    }
  }

  throw new Error("No se pudo extraer AREAS_SCHEMA completo.");
}

export async function loadAreasSchema() {
  if (!schemaCachePromise) {
    // Leemos el schema TS como fuente de verdad para no duplicar el catalogo en otro archivo.
    schemaCachePromise = readFile(schemaPath, "utf8").then((source) => {
      const literal = extractAreasLiteral(source);
      return Function(`"use strict"; return (${literal});`)();
    });
  }

  return schemaCachePromise;
}

export function normalizeCodeFragment(value, fallback) {
  const compact = String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return compact.slice(0, 4) || fallback;
}

function buildUniqueCode(baseCode, order, usedCodes) {
  if (!usedCodes.has(baseCode)) {
    usedCodes.add(baseCode);
    return baseCode;
  }

  let suffix = 1;

  while (suffix < 100) {
    const suffixText = String(suffix);
    const candidate = `${baseCode.slice(0, Math.max(1, 4 - suffixText.length))}${suffixText}`;

    if (!usedCodes.has(candidate)) {
      usedCodes.add(candidate);
      return candidate;
    }

    suffix += 1;
  }

  const fallback = `AR${String(order).padStart(2, "0")}`;
  usedCodes.add(fallback);
  return fallback;
}

// Convierte el schema de areas en DTOs estables para la UI y la API.
export function buildCatalogAreaDtosFromSchema(areasSchema) {
  const usedCodes = new Set();

  return areasSchema.map((area, index) => {
    const order = index + 1;
    const baseCode = normalizeCodeFragment(area.id, `AR${String(order).padStart(2, "0")}`);

    return {
      id: area.id,
      code: buildUniqueCode(baseCode, order, usedCodes),
      name: area.name,
      order,
      status: "active",
    };
  });
}

// Genera el catalogo de indicadores a partir de las areas ya normalizadas.
export function buildCatalogIndicatorDtosFromSchema(areasSchema) {
  const areas = buildCatalogAreaDtosFromSchema(areasSchema);

  return areasSchema.flatMap((area, areaIndex) => {
    const areaCode = areas[areaIndex]?.code ?? `AR${String(areaIndex + 1).padStart(2, "0")}`;

    return area.indicators.map((indicator, indicatorIndex) => ({
      id: indicator.id,
      areaId: area.id,
      code: `${areaCode}-${String(indicatorIndex + 1).padStart(3, "0")}`,
      name: indicator.name,
      order: indicatorIndex + 1,
      status: "active",
    }));
  });
}

export function isQuestionVisible(question, answers) {
  if (question.visibleIf) {
    return answers?.[question.visibleIf.key] === question.visibleIf.equals;
  }

  return true;
}

export function isIndicatorVisible(indicator, responses) {
  if (indicator.visibleWhen) {
    const dependency = responses[indicator.visibleWhen.indicatorId] ?? defaultIndicatorResponse();
    return dependency.answers?.[indicator.visibleWhen.key] === indicator.visibleWhen.equals;
  }

  if (indicator.id === "asistencia-009" || indicator.id === "asistencia-010") {
    const dependency = responses["asistencia-008"] ?? defaultIndicatorResponse();
    return dependency.answers.answer === "SI";
  }

  if (indicator.id === "temas-laborales-015") {
    const dependency = responses["temas-laborales-014"] ?? defaultIndicatorResponse();
    return dependency.answers.answer === "SI";
  }

  return true;
}

function pctFromYesNo(value) {
  if (value === "SI") return 100;
  if (value === "NO") return 0;
  return null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function calcIndicatorPct(indicator, response) {
  const visibleQuestions = indicator.questions.filter((question) =>
    isQuestionVisible(question, response.answers ?? {})
  );

  const numericQuestions = visibleQuestions.filter((question) => question.kind === "number");
  if (numericQuestions.length === 1) {
    const value = response.answers?.[numericQuestions[0].key];
    if (typeof value === "number") {
      const normalized = value >= 0 && value <= 1 ? value * 100 : value;
      return clamp(normalized);
    }

    return null;
  }

  const yesNoQuestions = visibleQuestions.filter((question) => question.kind === "yesno");
  if (!yesNoQuestions.length) return null;

  const getAnswer = (key) => {
    const answer = response.answers?.[key];
    return typeof answer === "number" ? undefined : answer;
  };

  const hasDocumentQuestion = yesNoQuestions.some((question) => question.key === "hasDocument");
  const isUpdatedQuestion = yesNoQuestions.some((question) => question.key === "isUpdated");

  if (hasDocumentQuestion && isUpdatedQuestion) {
    const hasDocument = getAnswer("hasDocument");
    const isUpdated = getAnswer("isUpdated");

    if ([hasDocument, isUpdated].some((value) => value == null || value === "NA")) return null;
    if (hasDocument === "NO" || isUpdated === "NO") return 0;
    return 100;
  }

  if (hasDocumentQuestion) {
    return pctFromYesNo(getAnswer("hasDocument"));
  }

  if (yesNoQuestions.length === 1) {
    return pctFromYesNo(getAnswer(yesNoQuestions[0].key));
  }

  const values = yesNoQuestions.map((question) => getAnswer(question.key));
  if (values.some((value) => value == null || value === "NA")) return null;
  if (values.some((value) => value === "NO")) return 0;
  return 100;
}

export function statusFromPct(pct) {
  if (pct == null) return "pendiente";
  if (pct >= 100) return "completo";
  return "incompleto";
}

export function hasEvidence(response) {
  return Boolean(response?.file || response?.documentRef?.trim() || response?.comments?.trim());
}

// Usa todos los timestamps relevantes para ordenar actividad real del workspace.
export function getLastActivityAt(workspace) {
  const timestamps = [];

  Object.values(workspace.responses).forEach((response) => {
    if (response?.updatedAt) timestamps.push(response.updatedAt);
    if (response?.file?.uploadedAt) timestamps.push(response.file.uploadedAt);
  });

  Object.values(workspace.reviews).forEach((review) => {
    if (review?.reviewedAt) timestamps.push(review.reviewedAt);
  });

  if (workspace.submission.submittedAt) timestamps.push(workspace.submission.submittedAt);
  if (workspace.submission.returnedAt) timestamps.push(workspace.submission.returnedAt);
  if (workspace.submission.approvedAt) timestamps.push(workspace.submission.approvedAt);

  if (!timestamps.length) return null;
  return timestamps.sort().at(-1) ?? null;
}

// La prioridad importa: un bloqueo siempre domina sobre revision, envio o avance.
export function deriveFoundationStatus(workspace, observedCount, blockingCount, completionPct) {
  if (blockingCount > 0) return "BLOCKED";
  if (observedCount > 0 || workspace.submission.status === "devuelto") return "OBSERVED";
  if (workspace.submission.status === "aprobado") return "APPROVED";
  if (workspace.submission.status === "enviado") return "IN_REVIEW";
  if (completionPct > 0) return "IN_REVIEW";
  return "PENDING";
}

export function buildFoundationSchoolRows({
  schools = DEMO_SCHOOLS,
  cycleId,
  areasSchema,
  getWorkspaceSnapshot,
}) {
  // Esta vista resume el estado de cada colegio para fundacion y gestion.
  return schools.map((school) => {
    const workspace = normalizeWorkspaceSnapshot(
      getWorkspaceSnapshot({ schoolId: school.id, cycleId })
    );

    const visibleIndicators = areasSchema.flatMap((area) =>
      area.indicators
        .filter((indicator) => isIndicatorVisible(indicator, workspace.responses))
        .map((indicator) => ({
          indicator,
          response: workspace.responses[indicator.id] ?? defaultIndicatorResponse(),
          review: workspace.reviews[indicator.id] ?? null,
        }))
    );

    const total = visibleIndicators.length;
    let completeCount = 0;
    let pendingCount = 0;
    let observedCount = 0;
    let blockingCount = 0;
    let missingEvidenceCount = 0;

    for (const row of visibleIndicators) {
      const pct = calcIndicatorPct(row.indicator, row.response);
      const completionStatus = statusFromPct(pct);

      if (completionStatus === "completo") completeCount += 1;
      else pendingCount += 1;

      if (row.review?.status === "observado") observedCount += 1;
      if (row.review?.status === "bloqueado") blockingCount += 1;
      if (row.indicator.hasDocumentFields && !hasEvidence(row.response)) missingEvidenceCount += 1;
    }

    const completionPct = total > 0 ? Math.round((completeCount / total) * 100) : 0;

    return {
      id: school.id,
      code: school.code,
      name: school.name,
      managerName: school.managerName,
      managerEmail: school.managerEmail,
      cycleId,
      completionPct,
      status: deriveFoundationStatus(workspace, observedCount, blockingCount, completionPct),
      lastActivityAt: getLastActivityAt(workspace),
      pendingCount,
      observedCount,
      blockingCount,
      missingEvidenceCount,
    };
  });
}
