import type { YesNoNA } from "./schema/evaluacionSchema";

// Tipos canónicos del dominio FNI: respuestas, revisiones, envíos y contexto.
export type ResponseAnswer = YesNoNA | number | undefined;

export type UploadedPdf = {
  id?: string | null;
  name: string;
  type: string;
  size: number;
  dataUrl?: string | null;
  downloadUrl?: string | null;
  uploadedAt: string;
};

export type IndicatorResponse = {
  answers: Record<string, ResponseAnswer>;
  documentRef: string;
  comments: string;
  file?: UploadedPdf | null;
  updatedAt: string | null;
};

export type ReviewStatus = "pendiente" | "aprobado" | "observado" | "bloqueado";

export type IndicatorReview = {
  status: ReviewStatus;
  reviewComment: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type ReviewMap = Record<string, IndicatorReview>;

export type SubmissionStatus = "borrador" | "enviado" | "devuelto" | "aprobado";

export type SubmissionRecord = {
  status: SubmissionStatus;
  submittedAt: string | null;
  returnedAt: string | null;
  approvedAt: string | null;
  message: string;
};

export type IndicatorCompletionStatus = "pendiente" | "completo" | "incompleto";

export type SchoolCycleRef = {
  schoolId: string;
  cycleId: string;
};

export type FniWorkspaceSnapshot = {
  responses: Record<string, IndicatorResponse>;
  reviews: ReviewMap;
  submission: SubmissionRecord;
};

export function defaultIndicatorResponse(): IndicatorResponse {
  return {
    answers: {},
    documentRef: "",
    comments: "",
    file: null,
    updatedAt: null,
  };
}

export function defaultIndicatorReview(): IndicatorReview {
  return {
    status: "pendiente",
    reviewComment: "",
    reviewedAt: null,
    reviewedBy: null,
  };
}

export function defaultSubmissionRecord(): SubmissionRecord {
  return {
    status: "borrador",
    submittedAt: null,
    returnedAt: null,
    approvedAt: null,
    message: "",
  };
}
