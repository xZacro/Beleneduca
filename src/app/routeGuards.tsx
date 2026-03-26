import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import type { Role } from "../shared/auth";
import { canAccess } from "../shared/authZ";
import { useResolvedAuthUser } from "../shared/useResolvedAuthUser";
import { getHomeForUser } from "./routes/home";
import { ROUTES } from "./routes/routeConfig";

function AuthPending() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Validando sesión...
      </div>
    </div>
  );
}

export function HomeRedirect() {
  const { user, loading } = useResolvedAuthUser({ requireSession: true });
  if (loading) return <AuthPending />;
  if (!user) return <Navigate to={ROUTES.login} replace />;
  return <Navigate to={getHomeForUser(user)} replace />;
}

export function LoginRedirect({ children }: { children: ReactNode }) {
  const { user, loading } = useResolvedAuthUser({ requireSession: true });
  if (loading) return <AuthPending />;
  if (user) return <Navigate to={getHomeForUser(user)} replace />;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useResolvedAuthUser({ requireSession: true });
  if (loading) return <AuthPending />;
  if (!user) return <Navigate to={ROUTES.login} replace />;
  return <>{children}</>;
}

export function RequireRoles({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useResolvedAuthUser({ requireSession: true });
  if (loading) return <AuthPending />;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  if (!canAccess(user, roles)) {
    return <Navigate to={getHomeForUser(user)} replace />;
  }

  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  return <RequireRoles roles={[role]}>{children}</RequireRoles>;
}
