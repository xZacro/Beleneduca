export type FoundationReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "OBSERVED"
  | "APPROVED"
  | "BLOCKED";

export type FoundationSchoolRow = {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  managerEmail?: string;
  cycleId: string;
  completionPct: number;
  status: FoundationReviewStatus;
  lastActivityAt?: string;
  pendingCount?: number;
  observedCount?: number;
  blockingCount?: number;
  missingEvidenceCount?: number;
};
