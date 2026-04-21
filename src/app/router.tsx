import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

const AppLayout = lazy(() => import("./layout/AppLayout"));
const Login = lazy(() => import("../pages/Login"));
const AccountSecurity = lazy(() => import("../pages/account/Security"));

const FoundationDashboard = lazy(() => import("../pages/foundation/Dashboard"));
const SchoolDashboard = lazy(() => import("../pages/school/Dashboard"));

const CatalogPage = lazy(() => import("../pages/foundation/catalog/Catalog"));
const IndicatorDetail = lazy(() => import("../pages/foundation/catalog/IndicatorDetail"));

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("../pages/admin/Users"));
const AdminSessions = lazy(() => import("../pages/admin/Sessions"));
const AdminAudit = lazy(() => import("../pages/admin/Audit"));

const FoundationSchools = lazy(() => import("../pages/foundation/Schools"));

const SchoolFormPage = lazy(() => import("../pages/foundation/schools/SchoolFormPage"));
const FoundationSchoolDocumentsPage = lazy(
  () => import("../pages/foundation/schools/FoundationSchoolDocumentsPage")
);
const SchoolReviewPage = lazy(() => import("../pages/foundation/schools/SchoolReviewPage"));

const EvaluationPage = lazy(() => import("../pages/school/EvaluationPage"));
const SchoolDocumentsPage = lazy(() => import("../pages/school/SchoolDocumentsPage"));

import { ROUTES, ROUTE_META } from "./routes/routeConfig";
import {
  HomeRedirect,
  LoginRedirect,
  RequireAuth,
  RequireRole,
  RequireRoles,
} from "./routeGuards";

const rel = (abs: string) => abs.replace(/^\//, "");

const routePendingElement = (
  <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
    Cargando vista...
  </div>
);

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={routePendingElement}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: (
      <LoginRedirect>
        {withRouteSuspense(<Login />)}
      </LoginRedirect>
    ),
  },

  {
    path: ROUTES.root,
    element: (
      <RequireAuth>
        {withRouteSuspense(<AppLayout />)}
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },

      {
        path: rel(ROUTE_META["account.security"].path),
        element: (
          <RequireRoles roles={ROUTE_META["account.security"].roles}>
            {withRouteSuspense(<AccountSecurity />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["foundation.dashboard"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.dashboard"].roles}>
            {withRouteSuspense(<FoundationDashboard />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["foundation.schools"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.schools"].roles}>
            {withRouteSuspense(<FoundationSchools />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["foundation.schoolForm"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.schoolForm"].roles}>
            {withRouteSuspense(<SchoolFormPage />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["foundation.schoolDocuments"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.schoolDocuments"].roles}>
            {withRouteSuspense(<FoundationSchoolDocumentsPage />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["foundation.schoolReview"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.schoolReview"].roles}>
            {withRouteSuspense(<SchoolReviewPage />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["foundation.catalog"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.catalog"].roles}>
            {withRouteSuspense(<CatalogPage />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["foundation.catalogIndicator"].path),
        element: (
          <RequireRoles roles={ROUTE_META["foundation.catalogIndicator"].roles}>
            {withRouteSuspense(<IndicatorDetail />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["school.dashboard"].path),
        element: (
          <RequireRoles roles={ROUTE_META["school.dashboard"].roles}>
            {withRouteSuspense(<SchoolDashboard />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["school.evaluation"].path),
        element: (
          <RequireRoles roles={ROUTE_META["school.evaluation"].roles}>
            {withRouteSuspense(<EvaluationPage />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["school.documents"].path),
        element: (
          <RequireRoles roles={ROUTE_META["school.documents"].roles}>
            {withRouteSuspense(<SchoolDocumentsPage />)}
          </RequireRoles>
        ),
      },

      {
        path: rel(ROUTE_META["admin.root"].path),
        element: (
          <RequireRole role="ADMIN">
            {withRouteSuspense(<AdminDashboard />)}
          </RequireRole>
        ),
      },
      {
        path: rel(ROUTE_META["admin.users"].path),
        element: (
          <RequireRoles roles={ROUTE_META["admin.users"].roles}>
            {withRouteSuspense(<AdminUsers />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["admin.sessions"].path),
        element: (
          <RequireRoles roles={ROUTE_META["admin.sessions"].roles}>
            {withRouteSuspense(<AdminSessions />)}
          </RequireRoles>
        ),
      },
      {
        path: rel(ROUTE_META["admin.audit"].path),
        element: (
          <RequireRoles roles={ROUTE_META["admin.audit"].roles}>
            {withRouteSuspense(<AdminAudit />)}
          </RequireRoles>
        ),
      },
    ],
  },

  { path: "*", element: <Navigate to={ROUTES.root} replace /> },
]);
