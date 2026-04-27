import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..");

let apiProcess = null;
let baseUrl = "";
let capturedLogs = "";

function appendLog(chunk) {
  capturedLogs += chunk.toString("utf8");
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("No se pudo resolver un puerto libre.")));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = 12_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // seguimos esperando el arranque
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`La API Prisma no estuvo lista a tiempo.\n\nLogs:\n${capturedLogs}`);
}

function extractCookie(response) {
  const headerValue =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()[0]
      : response.headers.get("set-cookie");

  if (!headerValue) {
    throw new Error("La respuesta no incluyo cookie de sesion.");
  }

  return headerValue.split(";")[0];
}

class SessionClient {
  constructor(cookie) {
    this.cookie = cookie;
  }

  async request(pathname, options = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set("Cookie", this.cookie);

    return fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
    });
  }
}

async function loginAs(email, password = "demo") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(response.status, 200, `No se pudo iniciar sesion con ${email}`);
  return new SessionClient(extractCookie(response));
}

async function readJson(response) {
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

describe("API backend Prisma smoke", { concurrency: 1 }, () => {
  before(async () => {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    apiProcess = spawn(process.execPath, ["server/api-server.mjs"], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        FNI_API_STORAGE: "prisma",
        FNI_API_PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    apiProcess.stdout.on("data", appendLog);
    apiProcess.stderr.on("data", appendLog);

    await waitForServer(baseUrl);
  });

  after(async () => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill("SIGTERM");
      await new Promise((resolve) => {
        apiProcess.once("exit", resolve);
      });
    }
  });

  test("health expone storage prisma", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);

    const payload = await readJson(response);
    assert.equal(payload.storage.mode, "prisma");
  });

  test("solicitud de recuperacion queda registrada en Prisma", async () => {
    const recoveryResponse = await fetch(`${baseUrl}/api/auth/password-recovery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "ebravo@outlook.cl",
        message: "Perdi el acceso a mi cuenta.",
      }),
    });

    assert.equal(recoveryResponse.status, 200);

    const recoveryPayload = await readJson(recoveryResponse);
    assert.equal(recoveryPayload.ok, true);
    assert.equal(recoveryPayload.status, "PENDING");
    assert.equal(recoveryPayload.requesterEmail, "ebravo@outlook.cl");

    const admin = await loginAs("ebravo@outlook.cl");
    const auditResponse = await admin.request("/api/admin/audit");
    assert.equal(auditResponse.status, 200);

    const auditEvents = await readJson(auditResponse);
    assert.ok(
      auditEvents.some(
        (event) =>
          event.meta?.action === "PASSWORD_RECOVERY_REQUESTED" &&
          event.meta?.requesterEmail === "ebravo@outlook.cl"
      )
    );
  });

  test("ready expone estado operativo de Prisma", async () => {
    const response = await fetch(`${baseUrl}/api/ready`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("x-request-id"));

    const payload = await readJson(response);
    assert.equal(payload.ok, true);
    assert.equal(payload.storage.mode, "prisma");
    assert.equal(payload.storage.readiness.mode, "prisma");
    assert.equal(payload.documents.ok, true);
  });

  test("admin puede autenticarse y ver usuarios", async () => {
    const admin = await loginAs("ebravo@outlook.cl");

    const meResponse = await admin.request("/api/auth/me");
    assert.equal(meResponse.status, 200);

    const me = await readJson(meResponse);
    assert.equal(me.email, "ebravo@outlook.cl");
    assert.ok(me.roles.includes("ADMIN"));

    const usersResponse = await admin.request("/api/admin/users");
    assert.equal(usersResponse.status, 200);

    const users = await readJson(usersResponse);
    assert.ok(Array.isArray(users));
    assert.ok(users.some((user) => user.email === "ebravo@outlook.cl"));
    assert.ok(users.some((user) => user.email === "pedro.letelier@beleneduca.cl"));
    assert.ok(users.some((user) => user.email === "ppontillo@beleneduca.cl"));

    const cyclesResponse = await admin.request("/api/cycles");
    assert.equal(cyclesResponse.status, 200);

    const cycles = await readJson(cyclesResponse);
    assert.ok(Array.isArray(cycles));
    assert.ok(cycles.some((cycle) => typeof cycle.isClosed === "boolean"));

    const auditResponse = await admin.request("/api/admin/audit");
    assert.equal(auditResponse.status, 200);

    const auditEvents = await readJson(auditResponse);
    assert.ok(Array.isArray(auditEvents));
  });

  test("fundacion y colegio respetan permisos en Prisma", async () => {
    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const foundationSchoolsResponse = await foundation.request("/api/foundation/schools?cycleId=2026");
    assert.equal(foundationSchoolsResponse.status, 200);

    const foundationSchools = await readJson(foundationSchoolsResponse);
    assert.ok(Array.isArray(foundationSchools));
    assert.ok(foundationSchools.length >= 12);

    const school = await loginAs("ppontillo@beleneduca.cl");
    const ownWorkspaceResponse = await school.request("/api/fni/workspace?schoolId=sch_1&cycleId=2026");
    assert.equal(ownWorkspaceResponse.status, 200);

    const otherWorkspaceResponse = await school.request("/api/fni/workspace?schoolId=sch_2&cycleId=2026");
    assert.equal(otherWorkspaceResponse.status, 403);

    const adminUsersResponse = await school.request("/api/admin/users");
    assert.equal(adminUsersResponse.status, 403);
  });

  test("solo admin puede editar indicadores en Prisma", async () => {
    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const foundationUpdateResponse = await foundation.request("/api/indicators/asistencia-001", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "No deberia actualizarse",
        order: 99,
        status: "inactive",
      }),
    });
    assert.equal(foundationUpdateResponse.status, 403);

    const admin = await loginAs("ebravo@outlook.cl");
    const originalResponse = await admin.request("/api/indicators/asistencia-001");
    assert.equal(originalResponse.status, 200);
    const originalIndicator = await readJson(originalResponse);

    try {
      const updateResponse = await admin.request("/api/indicators/asistencia-001", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Asistencia - indicador editado",
          order: 3,
          status: "inactive",
        }),
      });
      assert.equal(updateResponse.status, 200);

      const updatedIndicator = await readJson(updateResponse);
      assert.equal(updatedIndicator.name, "Asistencia - indicador editado");
      assert.equal(updatedIndicator.order, 3);
      assert.equal(updatedIndicator.status, "inactive");
    } finally {
      const restoreResponse = await admin.request("/api/indicators/asistencia-001", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: originalIndicator.name,
          order: originalIndicator.order,
          status: originalIndicator.status,
        }),
      });
      assert.equal(restoreResponse.status, 200);
    }
  });

  test("fundacion puede editar y cerrar un ciclo; solo admin puede reabrirlo en Prisma", async () => {
    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const admin = await loginAs("ebravo@outlook.cl");
    const dashboardResponse = await foundation.request("/api/management/dashboard?cycleId=2026");
    assert.equal(dashboardResponse.status, 200);

    const dashboard = await readJson(dashboardResponse);
    const originalCycle = dashboard.cycle;

    if (originalCycle.isClosed) {
      const restoreOpenResponse = await admin.request("/api/management/cycles/2026/reopen", {
        method: "POST",
      });
      assert.equal(restoreOpenResponse.status, 200);
    }

    const updateResponse = await foundation.request("/api/management/cycles/2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${originalCycle.name} Prisma`,
        startsAt: originalCycle.startsAt,
        endsAt: originalCycle.endsAt,
      }),
    });
    assert.equal(updateResponse.status, 200);

    const updatedCycle = await readJson(updateResponse);
    assert.equal(updatedCycle.name, `${originalCycle.name} Prisma`);

    const closeResponse = await foundation.request("/api/management/cycles/2026/close", {
      method: "POST",
    });
    assert.equal(closeResponse.status, 200);

    const closedCycle = await readJson(closeResponse);
    assert.equal(closedCycle.isClosed, true);

    const blockedFoundationUpdateResponse = await foundation.request("/api/management/cycles/2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "No deberia actualizar",
        startsAt: originalCycle.startsAt,
        endsAt: originalCycle.endsAt,
      }),
    });
    assert.equal(blockedFoundationUpdateResponse.status, 409);

    const blockedFoundationReopenResponse = await foundation.request("/api/management/cycles/2026/reopen", {
      method: "POST",
    });
    assert.equal(blockedFoundationReopenResponse.status, 403);

    const reopenResponse = await admin.request("/api/management/cycles/2026/reopen", {
      method: "POST",
    });
    assert.equal(reopenResponse.status, 200);

    const reopenedCycle = await readJson(reopenResponse);
    assert.equal(reopenedCycle.isClosed, false);

    const restoreResponse = await foundation.request("/api/management/cycles/2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: originalCycle.name,
        startsAt: originalCycle.startsAt,
        endsAt: originalCycle.endsAt,
      }),
    });
    assert.equal(restoreResponse.status, 200);
  });
});
