import { listCycles } from "../admin/client";
import { getUser } from "../auth";
import { apiGet, apiPut } from "../api";
import type {
  FniFoundationSchoolsResponse,
  FniWorkspaceDto,
  FniWorkspaceQuery,
} from "./apiContracts";
import type { FoundationSchoolRow } from "./schools";
import {
  defaultSubmissionRecord,
  type FniWorkspaceSnapshot,
  type IndicatorResponse,
  type ReviewMap,
  type SchoolCycleRef,
  type SubmissionRecord,
} from "./types";

export type FniDataSource = "api";

// Contrato unico para leer y escribir el workspace FNI, sin importar el storage real.
export interface FniWorkspaceRepositoryAsync {
  readonly source: FniDataSource;
  readResponses(ref: SchoolCycleRef): Promise<Record<string, IndicatorResponse>>;
  saveResponses(ref: SchoolCycleRef, responses: Record<string, IndicatorResponse>): Promise<void>;
  readReviews(ref: SchoolCycleRef): Promise<ReviewMap>;
  saveReviews(ref: SchoolCycleRef, reviews: ReviewMap): Promise<void>;
  readSubmission(ref: SchoolCycleRef): Promise<SubmissionRecord>;
  saveSubmission(ref: SchoolCycleRef, submission: SubmissionRecord): Promise<void>;
  readWorkspace(ref: SchoolCycleRef): Promise<FniWorkspaceSnapshot>;
  listStoredContexts(): Promise<SchoolCycleRef[]>;
  inferSingleStoredContext(): Promise<SchoolCycleRef | null>;
  inferSingleCycleIdForSchool(schoolId: string): Promise<string | null>;
  listFoundationSchools(cycleId: string): Promise<FoundationSchoolRow[]>;
}

let cachedDefaultCycleId: string | null | undefined;
let pendingDefaultCycleId: Promise<string | null> | null = null;

function workspaceQuery(ref: FniWorkspaceQuery) {
  const params = new URLSearchParams({
    schoolId: ref.schoolId,
    cycleId: ref.cycleId,
  });

  return `?${params.toString()}`;
}

async function inferDefaultCycleId() {
  if (cachedDefaultCycleId !== undefined) {
    return cachedDefaultCycleId;
  }

  if (!pendingDefaultCycleId) {
    // Tomamos el ciclo abierto mas reciente como default para no obligar al usuario a elegir uno.
    pendingDefaultCycleId = listCycles()
      .then((cycles) => {
        const orderedCycles = [...cycles].sort((left, right) => right.id.localeCompare(left.id));
        const preferredCycle = orderedCycles.find((cycle) => cycle.status === "OPEN") ?? orderedCycles[0] ?? null;
        cachedDefaultCycleId = preferredCycle?.id ?? null;
        return cachedDefaultCycleId;
      })
      .finally(() => {
        pendingDefaultCycleId = null;
      });
  }

  return pendingDefaultCycleId;
}

export const apiFniRepository: FniWorkspaceRepositoryAsync = {
  source: "api",
  async readResponses(ref) {
    const payload = await apiGet<FniWorkspaceDto>(`/fni/workspace${workspaceQuery(ref)}`);
    return payload.responses ?? {};
  },
  async saveResponses(ref, responses) {
    await apiPut<void>(`/fni/workspace/responses${workspaceQuery(ref)}`, {
      responses,
    });
  },
  async readReviews(ref) {
    const payload = await apiGet<FniWorkspaceDto>(`/fni/workspace${workspaceQuery(ref)}`);
    return payload.reviews ?? {};
  },
  async saveReviews(ref, reviews) {
    await apiPut<void>(`/fni/workspace/reviews${workspaceQuery(ref)}`, {
      reviews,
    });
  },
  async readSubmission(ref) {
    const payload = await apiGet<FniWorkspaceDto>(`/fni/workspace${workspaceQuery(ref)}`);
    return payload.submission ?? defaultSubmissionRecord();
  },
  async saveSubmission(ref, submission) {
    await apiPut<void>(`/fni/workspace/submission${workspaceQuery(ref)}`, {
      submission,
    });
  },
  async readWorkspace(ref) {
    const payload = await apiGet<FniWorkspaceDto>(`/fni/workspace${workspaceQuery(ref)}`);
    return {
      responses: payload.responses ?? {},
      reviews: payload.reviews ?? {},
      submission: payload.submission ?? defaultSubmissionRecord(),
    };
  },
  async listStoredContexts() {
    const user = getUser();
    const cycleId = await inferDefaultCycleId();
    // Si el usuario pertenece a un colegio y tenemos un ciclo inferido, devolvemos un solo contexto.
    return user?.schoolId && cycleId ? [{ schoolId: user.schoolId, cycleId }] : [];
  },
  async inferSingleStoredContext() {
    // Si solo hay un contexto posible, el hook puede resolverlo automaticamente.
    const contexts = await this.listStoredContexts();
    return contexts.length === 1 ? contexts[0] : null;
  },
  async inferSingleCycleIdForSchool() {
    return inferDefaultCycleId();
  },
  async listFoundationSchools(cycleId) {
    return apiGet<FniFoundationSchoolsResponse>(`/foundation/schools?cycleId=${encodeURIComponent(cycleId)}`);
  },
};

export function getFniRepository() {
  return apiFniRepository;
}
