import { apiGet, apiPost, apiPut } from "../api";
import type {
  ManagementCycleCreateRequest,
  ManagementCycleUpdateRequest,
  ManagementDashboardCycleDto,
  ManagementDashboardDto,
} from "./apiContracts";

// Cliente de gestion: concentra operaciones de dashboard y ciclo para la fundacion/admin.
export function getManagementDashboard(cycleId: string) {
  return apiGet<ManagementDashboardDto>(
    `/management/dashboard?cycleId=${encodeURIComponent(cycleId)}`
  );
}

export function closeManagementCycle(cycleId: string) {
  return apiPost<ManagementDashboardCycleDto>(`/management/cycles/${encodeURIComponent(cycleId)}/close`);
}

export function reopenManagementCycle(cycleId: string) {
  return apiPost<ManagementDashboardCycleDto>(
    `/management/cycles/${encodeURIComponent(cycleId)}/reopen`
  );
}

export function createManagementCycle(payload: ManagementCycleCreateRequest) {
  return apiPost<ManagementDashboardCycleDto, ManagementCycleCreateRequest>(
    "/management/cycles",
    payload
  );
}

export function updateManagementCycle(cycleId: string, payload: ManagementCycleUpdateRequest) {
  return apiPut<ManagementDashboardCycleDto, ManagementCycleUpdateRequest>(
    `/management/cycles/${encodeURIComponent(cycleId)}`,
    payload
  );
}
