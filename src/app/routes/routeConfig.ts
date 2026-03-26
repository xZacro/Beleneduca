import type { Role } from "../../shared/auth";

export const ROUTES = {
  login: "/login",
  root: "/",

  foundation: {
    dashboard: "/foundation/dashboard",
    schools: "/foundation/schools",

    schoolForm: "/foundation/schools/:schoolId/form",
    schoolDocuments: "/foundation/schools/:schoolId/documents",
    schoolReview: "/foundation/schools/:schoolId/review",

    catalog: "/foundation/catalog",
    catalogIndicator: "/foundation/catalog/indicators/:indicatorId",
  },

  school: {
    dashboard: "/school/dashboard",
    evaluation: "/school/evaluation",
    documents: "/school/documents",
  },

  account: {
    security: "/account/security",
  },

  admin: {
    root: "/admin",
    users: "/admin/users",
    sessions: "/admin/sessions",
    audit: "/admin/audit",
  },
} as const;

export type RouteKey =
  | "foundation.dashboard"
  | "foundation.schools"
  | "foundation.schoolForm"
  | "foundation.schoolDocuments"
  | "foundation.schoolReview"
  | "foundation.catalog"
  | "foundation.catalogIndicator"
  | "school.dashboard"
  | "school.evaluation"
  | "school.documents"
  | "account.security"
  | "admin.root"
  | "admin.users"
  | "admin.sessions"
  | "admin.audit";

export const ROUTE_META: Record<RouteKey, { path: string; roles: Role[] }> = {
  "foundation.dashboard": { path: ROUTES.foundation.dashboard, roles: ["FUNDACION", "ADMIN"] },
  "foundation.schools": { path: ROUTES.foundation.schools, roles: ["FUNDACION", "ADMIN"] },

  "foundation.schoolForm": { path: ROUTES.foundation.schoolForm, roles: ["FUNDACION", "ADMIN"] },
  "foundation.schoolDocuments": { path: ROUTES.foundation.schoolDocuments, roles: ["FUNDACION", "ADMIN"] },
  "foundation.schoolReview": { path: ROUTES.foundation.schoolReview, roles: ["FUNDACION", "ADMIN"] },

  "foundation.catalog": { path: ROUTES.foundation.catalog, roles: ["FUNDACION", "ADMIN"] },
  "foundation.catalogIndicator": { path: ROUTES.foundation.catalogIndicator, roles: ["FUNDACION", "ADMIN"] },

  "school.dashboard": { path: ROUTES.school.dashboard, roles: ["COLEGIO"] },
  "school.evaluation": { path: ROUTES.school.evaluation, roles: ["COLEGIO"] },
  "school.documents": { path: ROUTES.school.documents, roles: ["COLEGIO"] },

  "account.security": {
    path: ROUTES.account.security,
    roles: ["ADMIN", "FUNDACION", "COLEGIO"],
  },

  "admin.root": { path: ROUTES.admin.root, roles: ["ADMIN"] },
  "admin.users": { path: ROUTES.admin.users, roles: ["ADMIN"] },
  "admin.sessions": { path: ROUTES.admin.sessions, roles: ["ADMIN"] },
  "admin.audit": { path: ROUTES.admin.audit, roles: ["ADMIN"] },
};
