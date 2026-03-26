import type { CycleSummaryDto } from "../admin/apiContracts";
import type { FoundationReviewStatus } from "../fni/schools";

export type ManagementDashboardSchoolDto = {
  id: string;
  code: string;
  name: string;
  cycleId: string;
  completionPct: number;
  status: FoundationReviewStatus;
  lastActivityAt: string | null;
  pendingCount: number;
  observedCount: number;
  blockingCount: number;
  missingEvidenceCount: number;
  submitted: boolean;
};

export type ManagementDashboardIssueDto = {
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  areaId: string | null;
  areaName: string | null;
  reviewStatus: "observado" | "bloqueado";
  detail: string;
  reviewedAt: string | null;
};

export type ManagementDashboardCycleDto = CycleSummaryDto & {
  isClosed: boolean;
};

export type ManagementDashboardDto = {
  cycle: ManagementDashboardCycleDto;
  schools: ManagementDashboardSchoolDto[];
  issues: ManagementDashboardIssueDto[];
};

export type ManagementCycleCreateRequest = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type ManagementCycleUpdateRequest = {
  name: string;
  startsAt: string | null;
  endsAt: string | null;
};
