import { apiDelete, apiPost } from "../api";
import type { SchoolCycleRef, UploadedPdf } from "./types";

const MAX_API_UPLOAD_BYTES = 10_000_000;
const MAX_INDICATOR_FILE_STEM_LENGTH = 80;

// Cliente de documentos: normaliza nombres de archivo, subidas y borrados de PDF.
type IndicatorDocumentNaming = {
  indicatorName: string;
  schoolCode: string;
  uploadedAt?: Date | string;
};

function documentQuery(ref: SchoolCycleRef, indicatorId: string) {
  const params = new URLSearchParams({
    schoolId: ref.schoolId,
    cycleId: ref.cycleId,
    indicatorId,
  });

  return `?${params.toString()}`;
}

export function getUploadedPdfHref(file?: UploadedPdf | null) {
  return file?.downloadUrl ?? file?.dataUrl ?? null;
}

export function openUploadedPdf(file?: UploadedPdf | null) {
  const href = getUploadedPdfHref(file);
  if (!href) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

function normalizeTextFragment(value: string, fallback: string) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  return normalized || fallback;
}

function normalizeSchoolCode(value: string) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();

  return normalized || "COLEGIO";
}

function formatUploadTimestamp(value?: Date | string) {
  const resolvedDate =
    value instanceof Date ? value : typeof value === "string" && value.trim() ? new Date(value) : new Date();
  const safeDate = Number.isNaN(resolvedDate.getTime()) ? new Date() : resolvedDate;

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const hours = String(safeDate.getHours()).padStart(2, "0");
  const minutes = String(safeDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

export function buildIndicatorPdfFileName({
  indicatorName,
  schoolCode,
  uploadedAt,
}: IndicatorDocumentNaming) {
  const normalizedIndicatorName = normalizeTextFragment(indicatorName, "indicador").slice(
    0,
    MAX_INDICATOR_FILE_STEM_LENGTH
  );
  const normalizedSchoolCode = normalizeSchoolCode(schoolCode);
  const normalizedTimestamp = formatUploadTimestamp(uploadedAt);

  return `${normalizedSchoolCode}_${normalizedIndicatorName}_${normalizedTimestamp}.pdf`;
}

function createNormalizedPdfFile(file: File, naming: IndicatorDocumentNaming) {
  const normalizedName = buildIndicatorPdfFileName(naming);

  return new File([file], normalizedName, {
    type: file.type || "application/pdf",
    lastModified: file.lastModified || Date.now(),
  });
}

export async function uploadIndicatorDocument(
  ref: SchoolCycleRef,
  indicatorId: string,
  file: File,
  currentFile?: UploadedPdf | null,
  naming?: IndicatorDocumentNaming
) {
  if (file.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF.");
  }

  if (file.size > MAX_API_UPLOAD_BYTES) {
    throw new Error("El PDF supera el límite local de 10 MB.");
  }

  // Si hay naming canonico, reconstruimos el archivo para que el backend reciba un nombre estable.
  const fileToUpload = naming ? createNormalizedPdfFile(file, naming) : file;
  const formData = new FormData();
  formData.append("file", fileToUpload, fileToUpload.name);

  if (currentFile?.id) {
    formData.append("replaceDocumentId", currentFile.id);
  }

  return apiPost<UploadedPdf, FormData>(`/fni/documents/upload${documentQuery(ref, indicatorId)}`, formData);
}

export async function deleteIndicatorDocument(documentId: string) {
  await apiDelete<void>(`/fni/documents/${encodeURIComponent(documentId)}`);
}
