const SESSION_COOKIE = "fni_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let providerPromise = null;

// Selecciona el proveedor de auth segun el modo de persistencia activo.
function resolveAuthMode() {
  return process.env.FNI_API_STORAGE === "prisma" ? "prisma" : "json";
}

async function getProvider() {
  if (!providerPromise) {
    providerPromise =
      resolveAuthMode() === "prisma"
        ? import("./fni-auth-prisma.mjs").then(({ createPrismaAuthProvider }) =>
            createPrismaAuthProvider()
          )
        : import("./fni-auth-json.mjs").then(({ createJsonAuthProvider }) =>
            createJsonAuthProvider()
          );
  }

  return providerPromise;
}

export function buildSetSessionCookie(sessionToken) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(
    sessionToken
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildClearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function initAuthStore() {
  const provider = await getProvider();
  await provider.init();
}

export async function closeAuthStore() {
  const provider = await getProvider();
  await provider.close();
}

export async function loginWithCredentials(email, password, request) {
  const provider = await getProvider();
  return provider.loginWithCredentials(email, password, request);
}

export async function getSessionFromRequest(request) {
  const provider = await getProvider();
  return provider.getSessionFromRequest(request);
}

export async function touchSession(sessionToken) {
  const provider = await getProvider();
  await provider.touchSession(sessionToken);
}

export async function recordHeartbeat(sessionToken) {
  const provider = await getProvider();
  await provider.recordHeartbeat(sessionToken);
}

export async function logoutSession(sessionToken) {
  const provider = await getProvider();
  await provider.logoutSession(sessionToken);
}

export async function changePassword(sessionToken, currentPassword, newPassword) {
  const provider = await getProvider();
  await provider.changePassword(sessionToken, currentPassword, newPassword);
}

export function isFoundationUser(user) {
  return user.roles.includes("FUNDACION") || user.roles.includes("ADMIN");
}

export function canAccessSchool(user, schoolId) {
  if (isFoundationUser(user)) return true;
  return user.roles.includes("COLEGIO") && user.schoolId === schoolId;
}
