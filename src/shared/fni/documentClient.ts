import { apiDelete, apiPost } from "../api";
import type { SchoolCycleRef, UploadedPdf } from "./types";

const MAX_API_UPLOAD_BYTES = 10_000_000;
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

export async function uploadIndicatorDocument(
  ref: SchoolCycleRef,
  indicatorId: string,
  file: File,
  currentFile?: UploadedPdf | null
) {
  if (file.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF.");
  }

  if (file.size > MAX_API_UPLOAD_BYTES) {
    throw new Error("El PDF supera el límite local de 10 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);

  if (currentFile?.id) {
    formData.append("replaceDocumentId", currentFile.id);
  }

  return apiPost<UploadedPdf, FormData>(`/fni/documents/upload${documentQuery(ref, indicatorId)}`, formData);
}

export async function deleteIndicatorDocument(documentId: string) {
  await apiDelete<void>(`/fni/documents/${encodeURIComponent(documentId)}`);
}
