import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveApiDataDir } from "./fni-data-dir.mjs";

const dataDir = resolveApiDataDir();
const documentsDir = path.join(dataDir, "documents");
const metadataPath = path.join(dataDir, "documents.json");

const MAX_UPLOAD_BYTES = 10_000_000;

let writeQueue = Promise.resolve();

function defaultDocumentsDb() {
  return {
    documents: {},
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeFileName(value) {
  return String(value ?? "document.pdf")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_");
}

async function ensureDocumentStore() {
  await mkdir(documentsDir, { recursive: true });

  try {
    await access(metadataPath);
  } catch {
    await writeFile(metadataPath, `${JSON.stringify(defaultDocumentsDb(), null, 2)}\n`, "utf8");
  }
}

async function readDocumentsDb() {
  await ensureDocumentStore();

  try {
    const raw = await readFile(metadataPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      documents: isRecord(parsed.documents) ? parsed.documents : {},
    };
  } catch {
    return defaultDocumentsDb();
  }
}

function updateDocumentsDb(mutator) {
  const nextWrite = writeQueue.then(async () => {
    const db = await readDocumentsDb();
    const result = await mutator(db);
    await mkdir(dataDir, { recursive: true });
    await writeFile(metadataPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return result;
  });

  writeQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

async function readRawBody(request, maxBytes = MAX_UPLOAD_BYTES + 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bufferChunk.length;

    if (size > maxBytes) {
      throw new Error("El cuerpo de la solicitud supera el limite permitido.");
    }

    chunks.push(bufferChunk);
  }

  return Buffer.concat(chunks);
}

async function parseMultipartForm(request) {
  const contentType = request.headers["content-type"] ?? "";
  const boundaryMatch = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("No se pudo resolver el boundary del formulario multipart.");
  }

  const rawBody = await readRawBody(request);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  let offset = rawBody.indexOf(boundaryBuffer);
  const files = [];
  const fields = {};

  while (offset >= 0) {
    offset += boundaryBuffer.length;

    if (rawBody[offset] === 45 && rawBody[offset + 1] === 45) {
      break;
    }

    if (rawBody[offset] === 13 && rawBody[offset + 1] === 10) {
      offset += 2;
    }

    const headerEnd = rawBody.indexOf(headerSeparator, offset);
    if (headerEnd < 0) break;

    const headerLines = rawBody
      .slice(offset, headerEnd)
      .toString("utf8")
      .split("\r\n")
      .filter(Boolean);

    const headers = Object.fromEntries(
      headerLines.map((line) => {
        const separatorIndex = line.indexOf(":");
        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        return [key, value];
      })
    );

    const disposition = headers["content-disposition"] ?? "";
    const dispositionMatch = disposition.match(
      /form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i
    );

    if (!dispositionMatch) {
      throw new Error("No se pudo interpretar una parte del formulario multipart.");
    }

    const fieldName = dispositionMatch[1];
    const fileName = dispositionMatch[2] ?? null;
    const partStart = headerEnd + headerSeparator.length;
    const nextBoundary = rawBody.indexOf(boundaryBuffer, partStart);
    if (nextBoundary < 0) break;

    const partEnd =
      rawBody[nextBoundary - 2] === 13 && rawBody[nextBoundary - 1] === 10
        ? nextBoundary - 2
        : nextBoundary;

    const valueBuffer = rawBody.slice(partStart, partEnd);

    if (fileName != null) {
      files.push({
        fieldName,
        fileName,
        contentType: headers["content-type"] ?? "application/octet-stream",
        data: valueBuffer,
      });
    } else {
      fields[fieldName] = valueBuffer.toString("utf8");
    }

    offset = nextBoundary;
  }

  return { files, fields };
}

export function buildDocumentDownloadUrl(documentId) {
  return `/api/fni/documents/${encodeURIComponent(documentId)}/download`;
}

function serializeDocument(meta) {
  return {
    id: meta.id,
    name: meta.name,
    type: meta.type,
    size: meta.size,
    uploadedAt: meta.uploadedAt,
    dataUrl: null,
    downloadUrl: buildDocumentDownloadUrl(meta.id),
  };
}

export async function upsertDocumentFromBuffer(payload) {
  await ensureDocumentStore();

  const documentId =
    typeof payload.documentId === "string" && payload.documentId.trim()
      ? payload.documentId.trim()
      : randomUUID();
  const existingMeta = await getDocumentMeta(documentId);
  const fileName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : existingMeta?.name ?? "document.pdf";
  const contentType =
    typeof payload.type === "string" && payload.type.trim()
      ? payload.type.trim()
      : existingMeta?.type ?? "application/pdf";
  const buffer = Buffer.isBuffer(payload.buffer)
    ? payload.buffer
    : Buffer.from(payload.buffer ?? "");
  const storageFileName =
    existingMeta?.storageFileName ?? `${documentId}-${safeFileName(fileName)}`;
  const uploadedAt =
    typeof payload.uploadedAt === "string" && payload.uploadedAt.trim()
      ? payload.uploadedAt.trim()
      : existingMeta?.uploadedAt ?? new Date().toISOString();
  const storagePath = path.join(documentsDir, storageFileName);

  await writeFile(storagePath, buffer);

  const documentMeta = {
    id: documentId,
    schoolId: payload.schoolId,
    cycleId: payload.cycleId,
    indicatorId: payload.indicatorId,
    name: fileName,
    type: contentType,
    size: buffer.length,
    storageFileName,
    uploadedAt,
    uploadedByEmail: payload.uploadedByEmail ?? existingMeta?.uploadedByEmail ?? null,
  };

  await updateDocumentsDb((db) => {
    db.documents[documentId] = documentMeta;
  });

  return serializeDocument(documentMeta);
}

export async function initDocumentStore() {
  await ensureDocumentStore();
}

export async function checkDocumentStoreReadiness() {
  await ensureDocumentStore();
  const db = await readDocumentsDb();

  return {
    ok: true,
    documentsDir,
    metadataPath,
    documentCount: Object.keys(db.documents ?? {}).length,
  };
}

export async function getDocumentMeta(documentId) {
  const db = await readDocumentsDb();
  const meta = db.documents[documentId];
  return isRecord(meta) ? meta : null;
}

export async function uploadDocumentFromRequest(request, payload) {
  const multipartPayload = await parseMultipartForm(request);
  const filePart =
    multipartPayload.files.find((candidate) => candidate.fieldName === "file") ??
    multipartPayload.files[0];

  if (!filePart) {
    throw new Error("No se encontro el archivo PDF en la solicitud.");
  }

  const fileName = filePart.fileName || "document.pdf";
  const isPdf =
    filePart.contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("Solo se permiten archivos PDF.");
  }

  if (filePart.data.length > MAX_UPLOAD_BYTES) {
    throw new Error("El PDF supera el limite local de 10 MB.");
  }

  const replaceDocumentId =
    typeof multipartPayload.fields.replaceDocumentId === "string" &&
    multipartPayload.fields.replaceDocumentId.trim()
      ? multipartPayload.fields.replaceDocumentId.trim()
      : null;

  if (replaceDocumentId) {
    await deleteDocument(replaceDocumentId);
  }

  const documentId = randomUUID();
  const storageFileName = `${documentId}-${safeFileName(fileName)}`;
  const storagePath = path.join(documentsDir, storageFileName);
  const uploadedAt = new Date().toISOString();

  await writeFile(storagePath, filePart.data);

  const documentMeta = {
    id: documentId,
    schoolId: payload.schoolId,
    cycleId: payload.cycleId,
    indicatorId: payload.indicatorId,
    name: fileName,
    type: "application/pdf",
    size: filePart.data.length,
    storageFileName,
    uploadedAt,
    uploadedByEmail: payload.uploadedByEmail ?? null,
  };

  await updateDocumentsDb((db) => {
    db.documents[documentId] = documentMeta;
  });

  return serializeDocument(documentMeta);
}

export async function deleteDocument(documentId) {
  const documentMeta = await getDocumentMeta(documentId);
  if (!documentMeta) return null;

  await updateDocumentsDb((db) => {
    delete db.documents[documentId];
  });

  try {
    await unlink(path.join(documentsDir, documentMeta.storageFileName));
  } catch {
    // Ignore missing files in local development.
  }

  return documentMeta;
}

export async function readDocument(documentId) {
  const documentMeta = await getDocumentMeta(documentId);
  if (!documentMeta) return null;

  const buffer = await readFile(path.join(documentsDir, documentMeta.storageFileName));

  return {
    meta: documentMeta,
    buffer,
  };
}
