import { hasRole, type User } from "../../shared/auth";
import { ROUTES } from "./routeConfig";

/**
 * Home por rol con prioridad:
 * ADMIN > FUNDACION > COLEGIO
 * (así queda centralizado y lo usa Login, Router, guards, etc.)
 */
export function getHomeForUser(user: User) {
  if (hasRole(user, "ADMIN")) return ROUTES.admin.root;
  if (hasRole(user, "FUNDACION")) return ROUTES.foundation.dashboard;
  if (hasRole(user, "COLEGIO")) return ROUTES.school.dashboard;
  return ROUTES.login;
}
