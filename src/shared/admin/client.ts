import { apiGet, apiPost, apiPut } from "../api";
import type { CatalogIndicatorDto, CatalogIndicatorUpdateRequest } from "../fni/apiContracts";
import type {
  AdminAuditEventDto,
  AdminPasswordResetRequest,
  AdminSessionDto,
  AdminUserCreateRequest,
  AdminUserDto,
  AdminUserUpdateRequest,
  CycleSummaryDto,
  SchoolSummaryDto,
} from "./apiContracts";

// Cliente de admin: agrupa lecturas y mutaciones sensibles del centro de control.
export function listSchools() {
  return apiGet<SchoolSummaryDto[]>("/schools");
}

export function listCycles() {
  return apiGet<CycleSummaryDto[]>("/cycles");
}

export function listUsers() {
  return apiGet<AdminUserDto[]>("/admin/users");
}

export function createUser(payload: AdminUserCreateRequest) {
  return apiPost<AdminUserDto, AdminUserCreateRequest>("/admin/users", payload);
}

export function updateUser(userId: string, payload: AdminUserUpdateRequest) {
  return apiPut<AdminUserDto, AdminUserUpdateRequest>(
    `/admin/users/${encodeURIComponent(userId)}`,
    payload
  );
}

export function resetUserPassword(userId: string, payload: AdminPasswordResetRequest) {
  return apiPost<void, AdminPasswordResetRequest>(
    `/admin/users/${encodeURIComponent(userId)}/reset-password`,
    payload
  );
}

export function listSessions() {
  return apiGet<AdminSessionDto[]>("/admin/sessions");
}

export function listAuditEvents() {
  return apiGet<AdminAuditEventDto[]>("/admin/audit");
}

export function updateCatalogIndicator(indicatorId: string, payload: CatalogIndicatorUpdateRequest) {
  return apiPut<CatalogIndicatorDto, CatalogIndicatorUpdateRequest>(
    `/indicators/${encodeURIComponent(indicatorId)}`,
    payload
  );
}
