import "dotenv/config";

import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildClearSessionCookie,
  buildSetSessionCookie,
  canAccessSchool,
  changePassword,
  closeAuthStore,
  getSessionFromRequest,
  initAuthStore,
  isFoundationUser,
  loginWithCredentials,
  logoutSession,
  recordHeartbeat,
  touchSession,
} from "./fni-auth.mjs";
import { closeAuditStore, initAuditStore, recordAuditEvent } from "./fni-audit.mjs";
import { defaultIndicatorResponse, isRecord, parseWorkspaceRef } from "./fni-domain.mjs";
import {
  checkDocumentStoreReadiness,
  deleteDocument,
  getDocumentMeta,
  initDocumentStore,
  readDocument,
  uploadDocumentFromRequest,
} from "./fni-documents.mjs";
import {
  closeManagementProvider,
  createManagementUser,
  initManagementProvider,
  listManagementAudit,
  listManagementCycles,
  listManagementSchools,
  listManagementSessions,
  listManagementUsers,
  resetManagementUserPassword,
  updateManagementUser,
} from "./fni-management.mjs";
import { createLogger, isRequestLoggingEnabled } from "./fni-logger.mjs";
import { createStorage } from "./fni-storage.mjs";

// Entrada HTTP principal: primero resuelve infraestructura y luego enruta cada dominio.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FNI_API_PORT ?? process.env.PORT ?? 4100);
const SERVE_STATIC = String(process.env.FNI_SERVE_STATIC ?? "false").trim().toLowerCase() === "true";
const STATIC_DIR = process.env.FNI_STATIC_DIR
  ? path.resolve(process.env.FNI_STATIC_DIR)
  : path.join(__dirname, "..", "dist");
const storage = await createStorage();
const logger = createLogger("api");

const KNOWN_CLIENT_ERROR_MESSAGES = [
  "Debes enviar",
  "El email",
  "El nombre",
  "El id del ciclo",
  "El nombre del ciclo",
  "El nombre del indicador",
  "El orden del indicador",
  "El estado del indicador",
  "El estado",
  "La fecha de inicio",
  "La fecha de termino",
  "La contrasena actual",
  "La nueva contrasena",
  "No pudimos validar la sesion actual",
  "No puedes desactivar tu propio usuario",
  "Debe existir al menos un usuario Admin activo",
  "La contraseña",
  "La nueva contraseña",
  "Ya existe un ciclo",
  "Los usuarios con rol Colegio",
  "Los usuarios con rol",
  "El colegio seleccionado",
  "No se encontro el ciclo",
  "No se encontro el usuario",
  "Se enviaron roles invalidos",
  "Debes enviar al menos un rol",
  "La administracion de usuarios requiere",
];

function buildCorsHeaders(request) {
  const origin = request.headers.origin;
  const headers = {};

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }

  return headers;
}

function sendJson(request, response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...buildCorsHeaders(request),
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(request, response, statusCode = 204, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    ...buildCorsHeaders(request),
    ...extraHeaders,
  });
  response.end();
}

function sendError(request, response, statusCode, message, extraHeaders = {}) {
  sendJson(request, response, statusCode, { message }, extraHeaders);
}

function sendPdf(request, response, file) {
  response.writeHead(200, {
    "Content-Type": file.meta.type,
    "Content-Length": String(file.buffer.length),
    "Content-Disposition": `inline; filename="${String(file.meta.name).replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
    ...buildCorsHeaders(request),
  });
  response.end(file.buffer);
}

function getStaticContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".ico") return "image/x-icon";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveStaticFile(requestPathname) {
  const normalizedPathname = decodeURIComponent(requestPathname || "/");
  const requestedRelativePath =
    normalizedPathname === "/" ? "index.html" : normalizedPathname.replace(/^\/+/, "");
  const requestedFilePath = path.resolve(STATIC_DIR, requestedRelativePath);

  if (!requestedFilePath.startsWith(STATIC_DIR)) {
    return null;
  }

  if (await fileExists(requestedFilePath)) {
    return {
      filePath: requestedFilePath,
      isFallback: requestedRelativePath === "index.html",
    };
  }

  if (path.extname(requestedRelativePath)) {
    return null;
  }

  const fallbackPath = path.join(STATIC_DIR, "index.html");
  if (!(await fileExists(fallbackPath))) {
    return null;
  }

  return {
    filePath: fallbackPath,
    isFallback: true,
  };
}

async function tryServeStaticApp(request, response, pathname) {
  if (!SERVE_STATIC) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const resolvedFile = await resolveStaticFile(pathname);
  if (!resolvedFile) {
    return false;
  }

  const buffer = await readFile(resolvedFile.filePath);
  const cacheControl =
    resolvedFile.isFallback || !resolvedFile.filePath.includes(`${path.sep}assets${path.sep}`)
      ? "no-store"
      : "public, max-age=31536000, immutable";

  response.writeHead(200, {
    "Content-Type": getStaticContentType(resolvedFile.filePath),
    "Content-Length": String(buffer.length),
    "Cache-Control": cacheControl,
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  response.end(buffer);
  return true;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("El cuerpo JSON es invalido.");
  }
}

function getPathname(request) {
  const url = new URL(request.url ?? "/", "http://localhost");
  return url.pathname.startsWith("/api") ? url.pathname.slice(4) || "/" : url.pathname;
}

function ensureSchoolAccess(request, response, user, schoolId) {
  if (canAccessSchool(user, schoolId)) return true;
  sendError(request, response, 403, "No tienes permisos para acceder a este colegio.");
  return false;
}

function ensureFoundationAccess(request, response, user) {
  if (isFoundationUser(user)) return true;
  sendError(request, response, 403, "Este recurso requiere perfil Fundacion o Admin.");
  return false;
}

function ensureAdminAccess(request, response, user) {
  if (user?.roles?.includes("ADMIN")) return true;
  sendError(request, response, 403, "Este recurso requiere perfil Admin.");
  return false;
}

function normalizeCycleId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error("El id del ciclo es obligatorio.");
  }

  return normalized;
}

function normalizeCycleName(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error("El nombre del ciclo es obligatorio.");
  }

  return normalized;
}

function normalizeCycleDateInput(value, field) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return field === "endsAt" ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      field === "endsAt" ? "La fecha de termino es invalida." : "La fecha de inicio es invalida."
    );
  }

  return date.toISOString();
}

function normalizeCycleWindow(startsAt, endsAt) {
  if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error("La fecha de termino no puede ser anterior a la fecha de inicio.");
  }

  return { startsAt, endsAt };
}

function normalizeCycleCreatePayload(body) {
  const id = normalizeCycleId(body.id);
  const name = normalizeCycleName(body.name);
  const startsAt = normalizeCycleDateInput(body.startsAt, "startsAt");
  const endsAt = normalizeCycleDateInput(body.endsAt, "endsAt");

  return {
    id,
    name,
    ...normalizeCycleWindow(startsAt, endsAt),
  };
}

function normalizeCycleUpdatePayload(body) {
  const name = normalizeCycleName(body.name);
  const startsAt = normalizeCycleDateInput(body.startsAt, "startsAt");
  const endsAt = normalizeCycleDateInput(body.endsAt, "endsAt");

  return {
    name,
    ...normalizeCycleWindow(startsAt, endsAt),
  };
}

function normalizeCatalogIndicatorStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "active" || normalized === "inactive") {
    return normalized;
  }

  throw new Error("El estado del indicador es invalido.");
}

function normalizeCatalogIndicatorOrder(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error("El orden del indicador debe ser un numero entero mayor o igual a 1.");
  }

  return normalized;
}

function normalizeCatalogIndicatorName(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error("El nombre del indicador es obligatorio.");
  }

  return normalized;
}

function normalizeCatalogIndicatorUpdatePayload(body) {
  return {
    name: normalizeCatalogIndicatorName(body.name),
    order: normalizeCatalogIndicatorOrder(body.order),
    status: normalizeCatalogIndicatorStatus(body.status),
  };
}

function isCycleClosed(cycle) {
  return Boolean(cycle?.isClosed || cycle?.closedAt || cycle?.status === "CLOSED");
}

async function ensureCycleEditable(request, response, cycleId) {
  const cycles = await listManagementCycles();
  const cycle = cycles.find((candidate) => candidate.id === cycleId);

  if (isCycleClosed(cycle)) {
    sendError(
      request,
      response,
      409,
      `El ciclo ${cycle?.name ?? cycleId} esta cerrado y no admite edicion.`
    );
    return false;
  }

  return true;
}

async function recordAuditEventSafe(type, actor, meta) {
  try {
    await recordAuditEvent(type, actor, meta);
  } catch (error) {
    logger.warn("no se pudo registrar auditoria", { error, type, actorEmail: actor?.email ?? null });
  }
}

async function buildReadinessPayload() {
  const [storageStatus, documentsStatus] = await Promise.all([
    typeof storage.checkReadiness === "function"
      ? storage.checkReadiness()
      : Promise.resolve({
          ok: true,
          mode: storage.mode,
          description: storage.description,
        }),
    checkDocumentStoreReadiness(),
  ]);

  return {
    ok: true,
    service: "fni-api-local",
    port: PORT,
    uptimeSeconds: Math.round(process.uptime()),
    storage: {
      mode: storage.mode,
      description: storage.description,
      readiness: storageStatus,
    },
    documents: documentsStatus,
  };
}

async function requireSession(request, response) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    sendError(request, response, 401, "Sesion no valida o expirada.", {
      "Set-Cookie": buildClearSessionCookie(),
    });
    return null;
  }

  await touchSession(session.sessionToken);
  return session;
}

async function requireSessionWithoutTouch(request, response) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    sendError(request, response, 401, "Sesion no valida o expirada.", {
      "Set-Cookie": buildClearSessionCookie(),
    });
    return null;
  }

  return session;
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = getPathname(request);
  const isApiRequest = url.pathname.startsWith("/api");

  // CORS y health checks van antes que cualquier validacion de sesion.
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...buildCorsHeaders(request),
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    });
    response.end();
    return;
  }

  // Endpoints operativos: permiten verificar que el proceso y el storage estan vivos.
  if (request.method === "GET" && pathname === "/health") {
    sendJson(request, response, 200, {
      ok: true,
      service: "fni-api-local",
      port: PORT,
      storage: {
        mode: storage.mode,
        description: storage.description,
      },
    });
    return;
  }

  // Readiness publica: confirma que el proceso y dependencias basicas estan disponibles.
  if (request.method === "GET" && pathname === "/ready") {
    try {
      const payload = await buildReadinessPayload();
      sendJson(request, response, 200, payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo verificar el estado operativo.";
      logger.error("readiness check failed", { error });
      sendJson(request, response, 503, {
        ok: false,
        service: "fni-api-local",
        port: PORT,
        storage: {
          mode: storage.mode,
          description: storage.description,
        },
        error: message,
      });
    }
    return;
  }

  // Auth publica: login, sesion actual, logout, heartbeat y cambio de contrasena.
  if (request.method === "POST" && pathname === "/auth/login") {
    const body = await readJsonBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      sendError(request, response, 400, "Debes enviar email y password.");
      return;
    }

    const login = await loginWithCredentials(email, password, request);
    if (!login) {
      sendError(request, response, 401, "Credenciales invalidas.");
      return;
    }

    sendJson(request, response, 200, login.user, {
      "Set-Cookie": buildSetSessionCookie(login.sessionToken),
    });
    return;
  }

  if (request.method === "GET" && (pathname === "/auth/me" || pathname === "/me")) {
    const session = await requireSession(request, response);
    if (!session) return;

    sendJson(request, response, 200, session.user);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/logout") {
    const session = await getSessionFromRequest(request);
    if (session) {
      await logoutSession(session.sessionToken);
    }

    sendNoContent(request, response, 204, {
      "Set-Cookie": buildClearSessionCookie(),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/auth/heartbeat") {
    const session = await requireSessionWithoutTouch(request, response);
    if (!session) return;

    await recordHeartbeat(session.sessionToken);
    sendNoContent(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/auth/change-password") {
    const session = await requireSession(request, response);
    if (!session) return;

    const body = await readJsonBody(request);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      sendError(request, response, 400, "Debes enviar currentPassword y newPassword.");
      return;
    }

    await changePassword(session.sessionToken, currentPassword, newPassword);
    sendNoContent(request, response);
    return;
  }

  // Fuera de /api, la API tambien puede servir el frontend compilado cuando esta activado.
  if (!isApiRequest) {
    const served = await tryServeStaticApp(request, response, url.pathname);
    if (served) {
      return;
    }

    sendError(request, response, 404, `Ruta no encontrada: ${pathname}`);
    return;
  }

  // Desde aqui en adelante, todo requiere sesion valida.
  const session = await requireSession(request, response);
  if (!session) return;

  // Workspace FNI: lectura/escritura del formulario, revisiones y envio por colegio/ciclo.
  if (request.method === "GET" && pathname === "/fni/workspace") {
    const ref = parseWorkspaceRef(url.searchParams);
    if (!ref) {
      sendError(request, response, 400, "Debes enviar schoolId y cycleId.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, ref.schoolId)) {
      return;
    }

    const workspace = await storage.getWorkspace(ref);
    sendJson(request, response, 200, workspace);
    return;
  }

  if (request.method === "PUT" && pathname === "/fni/workspace/responses") {
    const ref = parseWorkspaceRef(url.searchParams);
    if (!ref) {
      sendError(request, response, 400, "Debes enviar schoolId y cycleId.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, ref.schoolId)) {
      return;
    }

    if (!(await ensureCycleEditable(request, response, ref.cycleId))) {
      return;
    }

    const body = await readJsonBody(request);
    if (!isRecord(body.responses)) {
      sendError(request, response, 400, "Debes enviar un objeto responses.");
      return;
    }

    await storage.saveResponses(ref, body.responses);
    await recordAuditEventSafe("CHANGE", session.user, {
      action: "RESPONSES_SAVED",
      schoolId: ref.schoolId,
      cycleId: ref.cycleId,
      indicatorCount: Object.keys(body.responses).length,
    });
    sendNoContent(request, response);
    return;
  }

  if (request.method === "PUT" && pathname === "/fni/workspace/reviews") {
    const ref = parseWorkspaceRef(url.searchParams);
    if (!ref) {
      sendError(request, response, 400, "Debes enviar schoolId y cycleId.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, ref.schoolId)) {
      return;
    }

    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    if (!(await ensureCycleEditable(request, response, ref.cycleId))) {
      return;
    }

    const body = await readJsonBody(request);
    if (!isRecord(body.reviews)) {
      sendError(request, response, 400, "Debes enviar un objeto reviews.");
      return;
    }

    await storage.saveReviews(ref, body.reviews);
    await recordAuditEventSafe("CHANGE", session.user, {
      action: "REVIEWS_SAVED",
      schoolId: ref.schoolId,
      cycleId: ref.cycleId,
      indicatorCount: Object.keys(body.reviews).length,
    });
    sendNoContent(request, response);
    return;
  }

  if (request.method === "PUT" && pathname === "/fni/workspace/submission") {
    const ref = parseWorkspaceRef(url.searchParams);
    if (!ref) {
      sendError(request, response, 400, "Debes enviar schoolId y cycleId.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, ref.schoolId)) {
      return;
    }

    if (!(await ensureCycleEditable(request, response, ref.cycleId))) {
      return;
    }

    const body = await readJsonBody(request);
    if (!isRecord(body.submission)) {
      sendError(request, response, 400, "Debes enviar un objeto submission.");
      return;
    }

    await storage.saveSubmission(ref, body.submission);
    await recordAuditEventSafe("CHANGE", session.user, {
      action: "SUBMISSION_SAVED",
      schoolId: ref.schoolId,
      cycleId: ref.cycleId,
      submissionStatus:
        typeof body.submission.status === "string" ? body.submission.status : null,
    });
    sendNoContent(request, response);
    return;
  }

  // Evidencia documental: subida, descarga y eliminacion ligada al workspace activo.
  if (request.method === "POST" && pathname === "/fni/documents/upload") {
    const ref = parseWorkspaceRef(url.searchParams);
    const indicatorId = url.searchParams.get("indicatorId");

    if (!ref || !indicatorId) {
      sendError(request, response, 400, "Debes enviar schoolId, cycleId e indicatorId.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, ref.schoolId)) {
      return;
    }

    if (!(await ensureCycleEditable(request, response, ref.cycleId))) {
      return;
    }

    let uploadedFile;

    try {
      uploadedFile = await uploadDocumentFromRequest(request, {
        schoolId: ref.schoolId,
        cycleId: ref.cycleId,
        indicatorId,
        uploadedByEmail: session.user.email,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar el documento.";
      sendError(request, response, 400, message);
      return;
    }

    const workspace = await storage.getWorkspace(ref);
    const current = workspace.responses[indicatorId] ?? defaultIndicatorResponse();
    await storage.saveResponses(ref, {
      ...workspace.responses,
      [indicatorId]: {
        ...current,
        file: uploadedFile,
        updatedAt: new Date().toISOString(),
      },
    });

    await recordAuditEventSafe("CHANGE", session.user, {
      action: "DOCUMENT_UPLOADED",
      schoolId: ref.schoolId,
      cycleId: ref.cycleId,
      indicatorId,
      documentId: uploadedFile.id,
      fileName: uploadedFile.name,
    });
    sendJson(request, response, 200, uploadedFile);
    return;
  }

  if (request.method === "DELETE" && pathname.startsWith("/fni/documents/")) {
    const documentId = decodeURIComponent(pathname.slice("/fni/documents/".length));
    const documentMeta = await getDocumentMeta(documentId);

    if (!documentMeta) {
      sendError(request, response, 404, "Documento no encontrado.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, documentMeta.schoolId)) {
      return;
    }

    if (!(await ensureCycleEditable(request, response, documentMeta.cycleId))) {
      return;
    }

    await deleteDocument(documentId);

    const ref = {
      schoolId: documentMeta.schoolId,
      cycleId: documentMeta.cycleId,
    };
    const workspace = await storage.getWorkspace(ref);
    const current = workspace.responses[documentMeta.indicatorId] ?? defaultIndicatorResponse();

    if (current.file?.id === documentId) {
      await storage.saveResponses(ref, {
        ...workspace.responses,
        [documentMeta.indicatorId]: {
          ...current,
          file: null,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    await recordAuditEventSafe("CHANGE", session.user, {
      action: "DOCUMENT_DELETED",
      schoolId: documentMeta.schoolId,
      cycleId: documentMeta.cycleId,
      indicatorId: documentMeta.indicatorId,
      documentId,
      fileName: documentMeta.name,
    });
    sendNoContent(request, response);
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/fni/documents/")) {
    const match = pathname.match(/^\/fni\/documents\/([^/]+)\/download$/);
    const documentId = match?.[1] ? decodeURIComponent(match[1]) : null;

    if (!documentId) {
      sendError(request, response, 404, "Documento no encontrado.");
      return;
    }

    const documentMeta = await getDocumentMeta(documentId);
    if (!documentMeta) {
      sendError(request, response, 404, "Documento no encontrado.");
      return;
    }

    if (!ensureSchoolAccess(request, response, session.user, documentMeta.schoolId)) {
      return;
    }

    let file = null;

    try {
      file = await readDocument(documentId);
    } catch {
      file = null;
    }

    if (!file) {
      sendError(request, response, 404, "No se encontro el archivo solicitado.");
      return;
    }

    sendPdf(request, response, file);
    return;
  }

  // Vista de fundacion: listado consolidado de colegios y tablero operativo del ciclo.
  if (request.method === "GET" && pathname === "/foundation/schools") {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    const cycleId = url.searchParams.get("cycleId");
    if (!cycleId) {
      sendError(request, response, 400, "Debes enviar cycleId.");
      return;
    }

    const rows = await storage.listFoundationSchools(cycleId);
    sendJson(request, response, 200, rows);
    return;
  }

  if (request.method === "GET" && pathname === "/management/dashboard") {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    const cycleId = url.searchParams.get("cycleId");
    if (!cycleId) {
      sendError(request, response, 400, "Debes enviar cycleId.");
      return;
    }

    const payload = await storage.getManagementDashboard(cycleId);
    sendJson(request, response, 200, payload);
    return;
  }

  if (request.method === "GET" && pathname === "/schools") {
    const rows = await listManagementSchools(session.user);
    sendJson(request, response, 200, rows);
    return;
  }

  if (request.method === "GET" && pathname === "/cycles") {
    const rows = await listManagementCycles();
    sendJson(request, response, 200, rows);
    return;
  }

  // Gestion de ciclos: crear, editar, cerrar y reabrir con reglas de acceso distintas.
  if (request.method === "POST" && pathname === "/management/cycles") {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    const body = await readJsonBody(request);
    const payload = normalizeCycleCreatePayload(body);
    const cycle = await storage.createCycle(payload);

    await recordAuditEventSafe("CHANGE", session.user, {
      action: "CYCLE_CREATED",
      cycleId: cycle.id,
      cycleName: cycle.name,
      startsAt: cycle.startsAt ?? null,
      endsAt: cycle.endsAt ?? null,
    });

    sendJson(request, response, 201, cycle);
    return;
  }

  if (request.method === "PUT" && pathname.startsWith("/management/cycles/")) {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    const match = pathname.match(/^\/management\/cycles\/([^/]+)$/);
    const cycleId = match?.[1] ? decodeURIComponent(match[1]) : null;

    if (!cycleId) {
      sendError(request, response, 404, "Ciclo no encontrado.");
      return;
    }

    if (!(await ensureCycleEditable(request, response, cycleId))) {
      return;
    }

    const body = await readJsonBody(request);
    const payload = normalizeCycleUpdatePayload(body);
    const cycle = await storage.updateCycle(cycleId, payload);

    await recordAuditEventSafe("CHANGE", session.user, {
      action: "CYCLE_UPDATED",
      cycleId: cycle.id,
      cycleName: cycle.name,
      startsAt: cycle.startsAt ?? null,
      endsAt: cycle.endsAt ?? null,
    });

    sendJson(request, response, 200, cycle);
    return;
  }

  if (request.method === "POST" && pathname.startsWith("/management/cycles/")) {
    const reopenMatch = pathname.match(/^\/management\/cycles\/([^/]+)\/reopen$/);
    const reopenCycleId = reopenMatch?.[1] ? decodeURIComponent(reopenMatch[1]) : null;

    if (reopenCycleId) {
      if (!ensureAdminAccess(request, response, session.user)) {
        return;
      }

      const cycle = await storage.reopenCycle(reopenCycleId);
      await recordAuditEventSafe("CHANGE", session.user, {
        action: "CYCLE_REOPENED",
        cycleId: cycle.id,
        cycleName: cycle.name,
      });
      sendJson(request, response, 200, cycle);
      return;
    }

    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    const closeMatch = pathname.match(/^\/management\/cycles\/([^/]+)\/close$/);
    const closeCycleId = closeMatch?.[1] ? decodeURIComponent(closeMatch[1]) : null;

    if (!closeCycleId) {
      sendError(request, response, 404, "Ciclo no encontrado.");
      return;
    }

    const cycle = await storage.closeCycle(closeCycleId);
    await recordAuditEventSafe("CHANGE", session.user, {
      action: "CYCLE_CLOSED",
      cycleId: closeCycleId,
      cycleName: cycle.name,
      closedAt: cycle.closedAt ?? null,
    });
    sendJson(request, response, 200, cycle);
    return;
  }

  // Centro de control administrativo: usuarios, sesiones y auditoria.
  if (request.method === "GET" && pathname === "/admin/users") {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    const rows = await listManagementUsers();
    sendJson(request, response, 200, rows);
    return;
  }

  if (request.method === "POST" && pathname === "/admin/users") {
    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    const body = await readJsonBody(request);
    const user = await createManagementUser(body, session.user);
    sendJson(request, response, 201, user);
    return;
  }

  if (request.method === "PUT" && pathname.startsWith("/admin/users/")) {
    const match = pathname.match(/^\/admin\/users\/([^/]+)$/);
    const userId = match?.[1] ? decodeURIComponent(match[1]) : null;

    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    if (!userId) {
      sendError(request, response, 404, "Usuario no encontrado.");
      return;
    }

    const body = await readJsonBody(request);
    const user = await updateManagementUser(userId, body, session.user);
    sendJson(request, response, 200, user);
    return;
  }

  if (request.method === "POST" && pathname.startsWith("/admin/users/")) {
    const match = pathname.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
    const userId = match?.[1] ? decodeURIComponent(match[1]) : null;

    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    if (!userId) {
      sendError(request, response, 404, "Usuario no encontrado.");
      return;
    }

    const body = await readJsonBody(request);
    await resetManagementUserPassword(userId, body.password, session.user);
    sendNoContent(request, response);
    return;
  }

  if (request.method === "GET" && pathname === "/admin/sessions") {
    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    const rows = await listManagementSessions();
    sendJson(request, response, 200, rows);
    return;
  }

  if (request.method === "GET" && pathname === "/admin/audit") {
    if (!session.user.roles.includes("ADMIN")) {
      sendError(request, response, 403, "Este recurso requiere perfil Admin.");
      return;
    }

    const rows = await listManagementAudit();
    sendJson(request, response, 200, rows);
    return;
  }

  // Catalogo compartido: areas, indicadores y seed base para el entorno local.
  if (request.method === "GET" && pathname === "/areas") {
    const areas = await storage.listAreas();
    sendJson(request, response, 200, areas);
    return;
  }

  if (request.method === "GET" && pathname === "/indicators") {
    const rows = await storage.listIndicators({
      areaId: url.searchParams.get("areaId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    sendJson(request, response, 200, rows);
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/indicators/")) {
    const indicatorId = decodeURIComponent(pathname.slice("/indicators/".length));
    const indicator = await storage.getIndicator(indicatorId);

    if (!indicator) {
      sendError(request, response, 404, "No se encontro el indicador.");
      return;
    }

    sendJson(request, response, 200, indicator);
    return;
  }

  if (request.method === "PUT" && pathname.startsWith("/indicators/")) {
    if (!ensureAdminAccess(request, response, session.user)) {
      return;
    }

    const indicatorId = decodeURIComponent(pathname.slice("/indicators/".length));
    if (!indicatorId) {
      sendError(request, response, 404, "No se encontro el indicador.");
      return;
    }

    const body = await readJsonBody(request);
    const payload = normalizeCatalogIndicatorUpdatePayload(body);
    const indicator = await storage.updateIndicator(indicatorId, payload);

    await recordAuditEventSafe("CHANGE", session.user, {
      action: "INDICATOR_UPDATED",
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      areaId: indicator.areaId,
      order: indicator.order,
      status: indicator.status,
    });

    sendJson(request, response, 200, indicator);
    return;
  }

  if (request.method === "POST" && pathname === "/catalog/seed") {
    if (!ensureFoundationAccess(request, response, session.user)) {
      return;
    }

    // Seed util para reposicionar el catalogo y workspaces en ambientes locales o de prueba.
    const payload = await storage.seedCatalog();
    sendJson(request, response, 200, payload);
    return;
  }

  sendError(request, response, 404, `Ruta no encontrada: ${pathname}`);
}

const logAllRequests = isRequestLoggingEnabled();

const server = createServer((request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const pathname = getPathname(request);

  response.setHeader("X-Request-Id", requestId);
  response.on("finish", () => {
    const statusCode = response.statusCode || 200;
    const logMeta = {
      requestId,
      method: request.method ?? "GET",
      path: pathname,
      statusCode,
      durationMs: Date.now() - startedAt,
    };

    if (statusCode >= 500) {
      logger.error("request failed", logMeta);
      return;
    }

    if (statusCode >= 400) {
      logger.warn("request completed with client error", logMeta);
      return;
    }

    if (logAllRequests) {
      logger.info("request completed", logMeta);
    }
  });

  handleRequest(request, response).catch((error) => {
    let statusCode = 500;
    let message = error instanceof Error ? error.message : "Error interno del servidor.";

    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      statusCode = 409;
      message = "Ya existe un registro con esos datos.";
    } else if (
      error instanceof Error &&
      KNOWN_CLIENT_ERROR_MESSAGES.some((candidate) => error.message.startsWith(candidate))
    ) {
      statusCode = 400;
    }

    logger.error("unhandled request error", {
      requestId,
      method: request.method ?? "GET",
      path: pathname,
      statusCode,
      error,
    });
    sendError(request, response, statusCode, message);
  });
});

let closing = false;

async function shutdown(signal) {
  if (closing) return;
  closing = true;

  logger.info("cerrando API", { signal });

  server.close(async () => {
    try {
      await Promise.all([
        storage.close(),
        closeAuthStore(),
        closeManagementProvider(),
        closeAuditStore(),
      ]);
      logger.info("API detenida");
    } catch (error) {
      logger.error("error cerrando recursos", { error });
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await Promise.all([
    storage.init(),
    initAuthStore(),
    initDocumentStore(),
    initManagementProvider(),
    initAuditStore(),
  ]);
} catch (error) {
  logger.error("no se pudo inicializar la API", { error });
  process.exit(1);
}

server.listen(PORT, () => {
  logger.info("API lista", {
    url: `http://localhost:${PORT}`,
    storageMode: storage.mode,
    storageDescription: storage.description,
  });
});
