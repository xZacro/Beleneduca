let providerPromise = null;

function resolveManagementMode() {
  return process.env.FNI_API_STORAGE === "prisma" ? "prisma" : "json";
}

async function getProvider() {
  if (!providerPromise) {
    providerPromise =
      resolveManagementMode() === "prisma"
        ? import("./fni-management-prisma.mjs").then(({ createPrismaManagementProvider }) =>
            createPrismaManagementProvider()
          )
        : import("./fni-management-json.mjs").then(({ createJsonManagementProvider }) =>
            createJsonManagementProvider()
          );
  }

  return providerPromise;
}

export async function initManagementProvider() {
  const provider = await getProvider();
  await provider.init();
}

export async function closeManagementProvider() {
  const provider = await getProvider();
  await provider.close();
}

export async function listManagementSchools(currentUser) {
  const provider = await getProvider();
  return provider.listSchools(currentUser);
}

export async function listManagementCycles() {
  const provider = await getProvider();
  return provider.listCycles();
}

export async function listManagementUsers() {
  const provider = await getProvider();
  return provider.listUsers();
}

export async function createManagementUser(payload, actorUser) {
  const provider = await getProvider();
  return provider.createUser(payload, actorUser);
}

export async function updateManagementUser(userId, payload, actorUser) {
  const provider = await getProvider();
  return provider.updateUser(userId, payload, actorUser);
}

export async function resetManagementUserPassword(userId, password, actorUser) {
  const provider = await getProvider();
  return provider.resetUserPassword(userId, password, actorUser);
}

export async function listManagementSessions() {
  const provider = await getProvider();
  return provider.listSessions();
}

export async function listManagementAudit() {
  const provider = await getProvider();
  return provider.listAudit();
}
