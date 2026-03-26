import type { FoundationSchoolRow } from "./schools";
import type {
  FniWorkspaceSnapshot,
  IndicatorResponse,
  ReviewMap,
  SchoolCycleRef,
  SubmissionRecord,
} from "./types";

export type CatalogStatus = "active" | "inactive";

export type CatalogAreaDto = {
  id: string;
  code: string;
  name: string;
  order: number;
  status: CatalogStatus;
};

export type CatalogIndicatorDto = {
  id: string;
  areaId: string;
  code: string;
  name: string;
  order: number;
  status: CatalogStatus;
};

export type CatalogIndicatorUpdateRequest = {
  name: string;
  order: number;
  status: CatalogStatus;
};

export type CatalogSeedResponse = {
  ok: true;
  areas: number;
  indicators: number;
  workspaces: number;
};

export type FniWorkspaceQuery = SchoolCycleRef;

export type FniWorkspaceDto = FniWorkspaceSnapshot;

export type FniResponsesUpsertRequest = {
  responses: Record<string, IndicatorResponse>;
};

export type FniReviewsUpsertRequest = {
  reviews: ReviewMap;
};

export type FniSubmissionUpsertRequest = {
  submission: SubmissionRecord;
};

export type FniFoundationSchoolsResponse = FoundationSchoolRow[];
