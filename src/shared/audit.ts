import type { Role, User } from "./auth";

export type AuditEventType =
  | "LOGIN"
  | "LOGOUT"
  | "HEARTBEAT"
  | "ROLE_SWITCH"
  | "CHANGE";

export type AuditChangeMeta = {
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  before?: unknown;
  after?: unknown;
};

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  at: string;
  actor: {
    name: string;
    email: string;
    roles: Role[];
    schoolId?: string | null;
  };
  meta?: Record<string, unknown>;
};

export type SessionStatus = "online" | "idle" | "offline";

export type SessionRow = {
  email: string;
  name: string;
  roles: Role[];
  schoolId?: string | null;
  status: SessionStatus;
  lastSeenAt?: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  lastEventType?: AuditEventType;
};

export function nowIso() {
  return new Date().toISOString();
}

export function msSince(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(iso).getTime();
}

export function makeActor(user: User): AuditEvent["actor"] {
  return {
    name: user.name,
    email: user.email,
    roles: user.roles,
    schoolId: user.schoolId ?? null,
  };
}

export function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
