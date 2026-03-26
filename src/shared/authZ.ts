import { hasRole, type Role, type User } from "./auth";

/**
 * Regla central para permisos.
 * Si mañana ADMIN puede ver vistas de COLEGIO también, se define aquí.
 */
export function canAccess(user: User, required: Role[]) {
  if (required.includes("FUNDACION") && hasRole(user, "ADMIN")) return true;

  return required.some((role) => hasRole(user, role));
}
