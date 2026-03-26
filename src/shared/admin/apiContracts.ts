import type { Role } from "../auth";

export type SchoolStatus = "ACTIVE" | "INACTIVE";
export type CycleStatus = "OPEN" | "CLOSED" | "ARCHIVED";
export type AdminUserStatus = "ACTIVE" | "INVITED" | "DISABLED";
export type AdminSessionStatus = "ONLINE" | "IDLE" | "OFFLINE" | "REVOKED";
export type AuditEventType = "LOGIN" | "LOGOUT" | "HEARTBEAT" | "ROLE_SWITCH" | "CHANGE";

export type SchoolSummaryDto = {
  id: string;
  code: string;
  name: string;
  managerName: string | null;
  managerEmail: string | null;
  status: SchoolStatus;
};

export type CycleSummaryDto = {
  id: string;
  name: string;
  status: CycleStatus;
  startsAt: string | null;
  endsAt: string | null;
  closedAt: string | null;
  isClosed: boolean;
};

export type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  schoolId: string | null;
  schoolName: string | null;
  status: AdminUserStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminUserCreateRequest = {
  name: string;
  email: string;
  roles: Role[];
  schoolId: string | null;
  status: AdminUserStatus;
  password: string;
};

export type AdminUserUpdateRequest = {
  name: string;
  email: string;
  roles: Role[];
  schoolId: string | null;
  status: AdminUserStatus;
};

export type AdminPasswordResetRequest = {
  password: string;
};

export type AdminSessionDto = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  roles: Role[];
  schoolId: string | null;
  status: AdminSessionStatus;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminAuditEventDto = {
  id: string;
  type: AuditEventType;
  at: string | null;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string;
  actorSchoolId: string | null;
  actorRoles: Role[];
  meta: Record<string, unknown> | null;
};
