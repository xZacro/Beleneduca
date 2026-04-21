import { ApiError, apiGet, apiPost } from "./api";

export type Role = "FUNDACION" | "COLEGIO" | "ADMIN";

export type User = {
  name: string;
  email: string;
  roles: Role[];
  schoolId?: string | null;
};

type LoginRequest = {
  email: string;
  password: string;
};

type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

type PasswordRecoveryRequest = {
  email: string;
  message?: string;
};

type PasswordRecoveryResponse = {
  ok: true;
};

const STORAGE_KEY = "fni_user";
const AUTH_CHANGE_EVENT = "fni-auth-changed";

let pendingSessionSync: Promise<User | null> | null = null;

function persistUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function isApiAuthEnabled() {
  return true;
}

export async function login(email: string, password: string): Promise<User | null> {
  try {
    const user = await apiPost<User, LoginRequest>("/auth/login", { email, password });
    persistUser(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
      persistUser(null);
      return null;
    }

    throw error;
  }
}

export async function logout() {
  try {
    await apiPost<void>("/auth/logout");
  } catch {
    // Si el backend ya no reconoce la sesion, igual limpiamos el cliente.
  }

  persistUser(null);
}

export async function heartbeatSession(): Promise<boolean> {
  try {
    await apiPost<void>("/auth/heartbeat");
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      persistUser(null);
      return false;
    }

    throw error;
  }
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  try {
    await apiPost<void, ChangePasswordRequest>("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      persistUser(null);
    }

    throw error;
  }
}

export async function requestPasswordRecovery(email: string, message?: string) {
  await apiPost<PasswordRecoveryResponse, PasswordRecoveryRequest>("/auth/password-recovery", {
    email,
    message,
  });
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User) {
  persistUser(user);
}

export function subscribeAuthChanges(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(AUTH_CHANGE_EVENT, listener as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, listener as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function syncUserFromApi(options?: { force?: boolean }): Promise<User | null> {
  const force = options?.force ?? false;
  const cached = getUser();
  if (cached && !force) {
    return cached;
  }

  if (!pendingSessionSync) {
    pendingSessionSync = apiGet<User>("/auth/me")
      .then((user) => {
        persistUser(user);
        return user;
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          persistUser(null);
          return null;
        }

        throw error;
      })
      .finally(() => {
        pendingSessionSync = null;
      });
  }

  return pendingSessionSync;
}

export function hasRole(user: User | null, role: Role) {
  return !!user?.roles?.includes(role);
}

export function roleLabel(user: User | null) {
  if (!user) return "-";
  if (hasRole(user, "ADMIN")) return "Admin";
  if (hasRole(user, "FUNDACION")) return "Fundación";
  if (hasRole(user, "COLEGIO")) return "Colegio";
  return "-";
}
