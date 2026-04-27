import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..");

let apiProcess = null;
let baseUrl = "";
let testDataDir = "";
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

async function waitForServer(url, timeoutMs = 10_000) {
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

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`La API no estuvo lista a tiempo.\n\nLogs:\n${capturedLogs}`);
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

describe("API backend", { concurrency: 1 }, () => {
  before(async () => {
    const port = await getFreePort();
    testDataDir = await mkdtemp(path.join(workspaceRoot, "server", ".test-data-"));
    baseUrl = `http://127.0.0.1:${port}`;

    apiProcess = spawn(process.execPath, ["server/api-server.mjs"], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        FNI_API_STORAGE: "json",
        FNI_API_PORT: String(port),
        FNI_API_DATA_DIR: testDataDir,
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

    if (testDataDir) {
      await rm(testDataDir, { recursive: true, force: true });
    }
  });

  test("rechaza auth/me sin sesion", async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);

    assert.equal(response.status, 401);
    assert.match(await response.text(), /Sesion no valida o expirada/i);
  });

  test("solicitud de recuperacion se registra como actividad interna", async () => {
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

  test("ready expone estado operativo del modo JSON", async () => {
    const response = await fetch(`${baseUrl}/api/ready`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("x-request-id"));

    const payload = await readJson(response);
    assert.equal(payload.ok, true);
    assert.equal(payload.storage.mode, "json");
    assert.equal(payload.storage.readiness.mode, "json");
    assert.equal(payload.documents.ok, true);
    assert.equal(typeof payload.documents.documentCount, "number");
  });

  test("colegio solo puede acceder a su propio workspace", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");

    const ownWorkspaceResponse = await school.request("/api/fni/workspace?schoolId=sch_1&cycleId=2026");
    assert.equal(ownWorkspaceResponse.status, 200);

    const ownWorkspace = await readJson(ownWorkspaceResponse);
    assert.deepEqual(Object.keys(ownWorkspace), ["responses", "reviews", "submission"]);

    const otherWorkspaceResponse = await school.request("/api/fni/workspace?schoolId=sch_2&cycleId=2026");
    assert.equal(otherWorkspaceResponse.status, 403);
  });

  test("responses y submission se persisten en workspace", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");

    const saveResponsesResponse = await school.request("/api/fni/workspace/responses?schoolId=sch_1&cycleId=2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        responses: {
          ind_test: {
            answers: { q1: "SI" },
            documentRef: "Acta 2026-01",
            comments: "Respuesta persistida en test",
            file: null,
            updatedAt: "2026-03-20T10:00:00.000Z",
          },
        },
      }),
    });
    assert.equal(saveResponsesResponse.status, 204);

    const saveSubmissionResponse = await school.request(
      "/api/fni/workspace/submission?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission: {
            status: "enviado",
            submittedAt: "2026-03-20T10:05:00.000Z",
            returnedAt: null,
            approvedAt: null,
            message: "Envio de prueba",
          },
        }),
      }
    );
    assert.equal(saveSubmissionResponse.status, 204);

    const workspaceResponse = await school.request("/api/fni/workspace?schoolId=sch_1&cycleId=2026");
    assert.equal(workspaceResponse.status, 200);

    const workspace = await readJson(workspaceResponse);
    assert.equal(workspace.responses.ind_test.answers.q1, "SI");
    assert.equal(workspace.responses.ind_test.documentRef, "Acta 2026-01");
    assert.equal(workspace.submission.status, "enviado");
    assert.equal(workspace.submission.message, "Envio de prueba");
  });

  test("documentos PDF se suben, descargan y eliminan", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");
    const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF");
    const formData = new FormData();

    formData.set("file", new Blob([pdfBuffer], { type: "application/pdf" }), "evidencia-test.pdf");

    const uploadResponse = await school.request(
      "/api/fni/documents/upload?schoolId=sch_1&cycleId=2026&indicatorId=ind_doc_test",
      {
        method: "POST",
        body: formData,
      }
    );
    assert.equal(uploadResponse.status, 200);

    const uploadedFile = await readJson(uploadResponse);
    assert.equal(uploadedFile.name, "evidencia-test.pdf");
    assert.equal(uploadedFile.type, "application/pdf");
    assert.ok(uploadedFile.id);
    assert.ok(uploadedFile.downloadUrl);

    const workspaceAfterUploadResponse = await school.request(
      "/api/fni/workspace?schoolId=sch_1&cycleId=2026"
    );
    const workspaceAfterUpload = await readJson(workspaceAfterUploadResponse);

    assert.equal(workspaceAfterUpload.responses.ind_doc_test.file.id, uploadedFile.id);

    const downloadResponse = await school.request(
      `/api/fni/documents/${encodeURIComponent(uploadedFile.id)}/download`
    );
    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadResponse.headers.get("content-type"), "application/pdf");
    assert.equal(Buffer.from(await downloadResponse.arrayBuffer()).compare(pdfBuffer), 0);

    const deleteResponse = await school.request(
      `/api/fni/documents/${encodeURIComponent(uploadedFile.id)}`,
      {
        method: "DELETE",
      }
    );
    assert.equal(deleteResponse.status, 204);

    const workspaceAfterDeleteResponse = await school.request(
      "/api/fni/workspace?schoolId=sch_1&cycleId=2026"
    );
    const workspaceAfterDelete = await readJson(workspaceAfterDeleteResponse);

    assert.equal(workspaceAfterDelete.responses.ind_doc_test.file, null);

    const deletedDownloadResponse = await school.request(
      `/api/fni/documents/${encodeURIComponent(uploadedFile.id)}/download`
    );
    assert.equal(deletedDownloadResponse.status, 404);
  });

  test("colegio no puede guardar reviews y fundacion si puede", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");
    const schoolReviewAttempt = await school.request("/api/fni/workspace/reviews?schoolId=sch_1&cycleId=2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviews: {
          ind_test: {
            status: "observado",
            reviewComment: "No deberia poder guardar esto",
            reviewedBy: "Colegio",
            reviewedAt: "2026-03-20T10:10:00.000Z",
          },
        },
      }),
    });
    assert.equal(schoolReviewAttempt.status, 403);

    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const foundationReviewAttempt = await foundation.request(
      "/api/fni/workspace/reviews?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviews: {
            ind_test: {
              status: "observado",
              reviewComment: "Observacion registrada por Fundacion",
              reviewedBy: "Fundacion",
              reviewedAt: "2026-03-20T10:15:00.000Z",
            },
          },
        }),
      }
    );
    assert.equal(foundationReviewAttempt.status, 204);

    const workspaceResponse = await foundation.request("/api/fni/workspace?schoolId=sch_1&cycleId=2026");
    const workspace = await readJson(workspaceResponse);

    assert.equal(workspace.reviews.ind_test.status, "observado");
    assert.equal(workspace.reviews.ind_test.reviewComment, "Observacion registrada por Fundacion");
  });

  test("permisos de foundation y admin en endpoints protegidos", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");
    const schoolDashboardResponse = await school.request("/api/management/dashboard?cycleId=2026");
    assert.equal(schoolDashboardResponse.status, 403);

    const schoolFoundationListResponse = await school.request("/api/foundation/schools?cycleId=2026");
    assert.equal(schoolFoundationListResponse.status, 403);

    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const foundationDashboardResponse = await foundation.request("/api/management/dashboard?cycleId=2026");
    assert.equal(foundationDashboardResponse.status, 200);

    const foundationAdminUsersResponse = await foundation.request("/api/admin/users");
    assert.equal(foundationAdminUsersResponse.status, 403);

    const admin = await loginAs("ebravo@outlook.cl");
    const adminUsersResponse = await admin.request("/api/admin/users");
    assert.equal(adminUsersResponse.status, 200);

    const adminUsers = await readJson(adminUsersResponse);
    assert.ok(Array.isArray(adminUsers));
    assert.ok(adminUsers.length >= 19);
  });

  test("solo admin puede editar indicadores del catalogo", async () => {
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
      assert.equal(updatedIndicator.id, "asistencia-001");
      assert.equal(updatedIndicator.name, "Asistencia - indicador editado");
      assert.equal(updatedIndicator.order, 3);
      assert.equal(updatedIndicator.status, "inactive");

      const indicatorResponse = await admin.request("/api/indicators/asistencia-001");
      assert.equal(indicatorResponse.status, 200);

      const indicator = await readJson(indicatorResponse);
      assert.equal(indicator.name, "Asistencia - indicador editado");
      assert.equal(indicator.status, "inactive");
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

  test("usuario autenticado puede cambiar su propia contrasena", async () => {
    const school = await loginAs("kimberly.orellana@beleneduca.cl");
    const changePasswordResponse = await school.request("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "demo",
        newPassword: "demo123",
      }),
    });

    assert.equal(changePasswordResponse.status, 204);

    const oldLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "kimberly.orellana@beleneduca.cl",
        password: "demo",
      }),
    });
    assert.equal(oldLoginResponse.status, 401);

    const newLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "kimberly.orellana@beleneduca.cl",
        password: "demo123",
      }),
    });
    assert.equal(newLoginResponse.status, 200);
  });

  test("admin puede consultar auditoria operativa", async () => {
    const admin = await loginAs("ebravo@outlook.cl");
    const auditResponse = await admin.request("/api/admin/audit");

    assert.equal(auditResponse.status, 200);

    const events = await readJson(auditResponse);
    assert.ok(Array.isArray(events));
    assert.ok(events.some((event) => event.type === "LOGIN"));
    assert.ok(
      events.some(
        (event) =>
          event.type === "CHANGE" &&
          ["RESPONSES_SAVED", "DOCUMENT_UPLOADED", "REVIEWS_SAVED", "PASSWORD_CHANGED"].includes(
            event.meta?.action
          )
      )
    );
  });

  test("fundacion y admin gestionan ciclos segun permisos definidos", async () => {
    const school = await loginAs("ppontillo@beleneduca.cl");
    const schoolCreateResponse = await school.request("/api/management/cycles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "2027",
        name: "Ciclo 2027",
        startsAt: "2027-03-01",
        endsAt: "2027-12-31",
      }),
    });
    assert.equal(schoolCreateResponse.status, 403);

    const schoolCloseResponse = await school.request("/api/management/cycles/2026/close", {
      method: "POST",
    });
    assert.equal(schoolCloseResponse.status, 403);

    const foundation = await loginAs("pedro.letelier@beleneduca.cl");
    const createResponse = await foundation.request("/api/management/cycles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "2027",
        name: "Ciclo 2027",
        startsAt: "2027-03-01",
        endsAt: "2027-12-31",
      }),
    });
    assert.equal(createResponse.status, 201);

    const createdCycle = await readJson(createResponse);
    assert.equal(createdCycle.id, "2027");
    assert.equal(createdCycle.name, "Ciclo 2027");
    assert.equal(createdCycle.status, "OPEN");
    assert.equal(createdCycle.isClosed, false);

    const updateResponse = await foundation.request("/api/management/cycles/2027", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Ciclo 2027 Ajustado",
        startsAt: "2027-03-15",
        endsAt: "2027-12-20",
      }),
    });
    assert.equal(updateResponse.status, 200);

    const updatedCycle = await readJson(updateResponse);
    assert.equal(updatedCycle.id, "2027");
    assert.equal(updatedCycle.name, "Ciclo 2027 Ajustado");

    const cyclesBeforeResponse = await foundation.request("/api/cycles");
    const cyclesBefore = await readJson(cyclesBeforeResponse);
    const cycleBefore = cyclesBefore.find((cycle) => cycle.id === "2026");
    const createdCycleAfter = cyclesBefore.find((cycle) => cycle.id === "2027");

    assert.equal(cycleBefore.status, "OPEN");
    assert.equal(createdCycleAfter.name, "Ciclo 2027 Ajustado");

    const closeResponse = await foundation.request("/api/management/cycles/2026/close", {
      method: "POST",
    });
    assert.equal(closeResponse.status, 200);

    const closedCycle = await readJson(closeResponse);
    assert.equal(closedCycle.id, "2026");
    assert.equal(closedCycle.status, "CLOSED");
    assert.ok(closedCycle.closedAt);
    assert.equal(closedCycle.isClosed, true);

    const cyclesAfterResponse = await foundation.request("/api/cycles");
    assert.equal(cyclesAfterResponse.status, 200);

    const cyclesAfter = await readJson(cyclesAfterResponse);
    const cycleAfter = cyclesAfter.find((cycle) => cycle.id === "2026");

    assert.equal(cycleAfter.status, "CLOSED");
    assert.ok(cycleAfter.closedAt);
    assert.equal(cycleAfter.isClosed, true);

    const dashboardResponse = await foundation.request("/api/management/dashboard?cycleId=2026");
    assert.equal(dashboardResponse.status, 200);

    const dashboard = await readJson(dashboardResponse);
    assert.equal(dashboard.cycle.id, "2026");
    assert.equal(dashboard.cycle.status, "CLOSED");
    assert.equal(dashboard.cycle.isClosed, true);

    const blockedResponsesResponse = await school.request(
      "/api/fni/workspace/responses?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responses: {
            ind_after_close: {
              answers: { q1: "NO" },
              documentRef: "",
              comments: "",
              file: null,
              updatedAt: "2026-03-20T10:30:00.000Z",
            },
          },
        }),
      }
    );
    assert.equal(blockedResponsesResponse.status, 409);

    const blockedSubmissionResponse = await school.request(
      "/api/fni/workspace/submission?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission: {
            status: "devuelto",
            submittedAt: null,
            returnedAt: "2026-03-20T10:31:00.000Z",
            approvedAt: null,
            message: "No deberia persistir",
          },
        }),
      }
    );
    assert.equal(blockedSubmissionResponse.status, 409);

    const blockedUploadFormData = new FormData();
    blockedUploadFormData.set(
      "file",
      new Blob([Buffer.from("%PDF-1.4\n%%EOF")], { type: "application/pdf" }),
      "cerrado.pdf"
    );

    const blockedUploadResponse = await school.request(
      "/api/fni/documents/upload?schoolId=sch_1&cycleId=2026&indicatorId=ind_doc_closed",
      {
        method: "POST",
        body: blockedUploadFormData,
      }
    );
    assert.equal(blockedUploadResponse.status, 409);

    const blockedReviewResponse = await foundation.request(
      "/api/fni/workspace/reviews?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviews: {
            ind_after_close: {
              status: "aprobado",
              reviewComment: "No deberia persistir",
              reviewedBy: "Fundacion",
              reviewedAt: "2026-03-20T10:32:00.000Z",
            },
          },
        }),
      }
    );
    assert.equal(blockedReviewResponse.status, 409);

    const blockedFoundationUpdateResponse = await foundation.request("/api/management/cycles/2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Ciclo 2026 bloqueado",
        startsAt: "2026-01-01",
        endsAt: "2026-12-31",
      }),
    });
    assert.equal(blockedFoundationUpdateResponse.status, 409);

    const blockedFoundationReopenResponse = await foundation.request("/api/management/cycles/2026/reopen", {
      method: "POST",
    });
    assert.equal(blockedFoundationReopenResponse.status, 403);

    const admin = await loginAs("ebravo@outlook.cl");
    const reopenResponse = await admin.request("/api/management/cycles/2026/reopen", {
      method: "POST",
    });
    assert.equal(reopenResponse.status, 200);

    const reopenedCycle = await readJson(reopenResponse);
    assert.equal(reopenedCycle.id, "2026");
    assert.equal(reopenedCycle.status, "OPEN");
    assert.equal(reopenedCycle.isClosed, false);

    const editableAgainResponse = await foundation.request("/api/management/cycles/2026", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Ciclo 2026 abierto nuevamente",
        startsAt: "2026-01-01",
        endsAt: "2026-12-31",
      }),
    });
    assert.equal(editableAgainResponse.status, 200);

    const schoolEditAfterReopenResponse = await school.request(
      "/api/fni/workspace/responses?schoolId=sch_1&cycleId=2026",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responses: {
            ind_after_reopen: {
              answers: { q1: "SI" },
              documentRef: "",
              comments: "Persistido tras reapertura",
              file: null,
              updatedAt: "2026-03-20T10:40:00.000Z",
            },
          },
        }),
      }
    );
    assert.equal(schoolEditAfterReopenResponse.status, 204);

    const auditResponse = await admin.request("/api/admin/audit");
    assert.equal(auditResponse.status, 200);

    const auditEvents = await readJson(auditResponse);
    assert.ok(
      auditEvents.some(
        (event) =>
          event.type === "CHANGE" &&
          event.meta?.action === "CYCLE_CREATED" &&
          event.meta?.cycleId === "2027"
      )
    );
    assert.ok(
      auditEvents.some(
        (event) =>
          event.type === "CHANGE" &&
          event.meta?.action === "CYCLE_UPDATED" &&
          ["2026", "2027"].includes(String(event.meta?.cycleId ?? ""))
      )
    );
    assert.ok(
      auditEvents.some(
        (event) =>
          event.type === "CHANGE" &&
          event.meta?.action === "CYCLE_CLOSED" &&
          event.meta?.cycleId === "2026"
      )
    );
    assert.ok(
      auditEvents.some(
        (event) =>
          event.type === "CHANGE" &&
          event.meta?.action === "CYCLE_REOPENED" &&
          event.meta?.cycleId === "2026"
      )
    );
  });
});
