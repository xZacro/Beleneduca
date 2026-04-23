import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const docsDir = path.join(rootDir, "docs");
const assetDir = path.join(docsDir, "assets", "manual-usuario");
const htmlPath = path.join(docsDir, "manual-usuario.html");
const pdfPath = path.join(docsDir, "manual-usuario.pdf");
const distDir = path.join(rootDir, "dist");

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const screenshots = [
  { file: "login.png", title: "Ingreso al sistema", caption: "Pantalla de entrada con recuperacion de contrasena." },
  { file: "school-dashboard.png", title: "Dashboard colegio", caption: "Resumen del avance y siguientes pasos del colegio." },
  { file: "school-evaluation.png", title: "Evaluacion FNI", caption: "Formulario de evaluacion con estado por indicador." },
  { file: "school-documents.png", title: "Documentos del colegio", caption: "Carga, descarga y seguimiento de archivos PDF." },
  { file: "foundation-dashboard.png", title: "Dashboard fundacion", caption: "Vista operativa del ciclo y sus colegios." },
  { file: "foundation-schools.png", title: "Colegios", caption: "Listado filtrable de colegios con estado y avance." },
  { file: "foundation-review.png", title: "Revision del colegio", caption: "Revision con observaciones y bloqueos." },
  { file: "foundation-catalog.png", title: "Catalogo FNI", caption: "Referencia de areas e indicadores." },
  { file: "admin-dashboard.png", title: "Panel administrativo", caption: "Consola global de usuarios, actividad y ciclos." },
  { file: "admin-users.png", title: "Usuarios", caption: "Gestion de usuarios, roles y contrasenas." },
  { file: "admin-audit.png", title: "Actividad", caption: "Auditoria operativa y trazabilidad de eventos." },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
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

async function waitForHttp(url, timeoutMs = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // seguimos esperando
    }

    await sleep(200);
  }

  throw new Error(`Timeout esperando ${url}`);
}

function findChromePath() {
  return chromeCandidates.find((candidate) => existsSync(candidate)) ?? null;
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  child.getLogs = () => logs;
  return child;
}

async function waitForProcessExit(child, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timeout esperando ${child.spawnargs?.[0] ?? "proceso"}`));
    }, timeoutMs);

    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 0);
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function runChromeCommand(args) {
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("No se encontro Chrome ni Edge en ubicaciones conocidas.");
  }

  const child = spawnProcess(chromePath, args);
  const exitCode = await waitForProcessExit(child);

  if (exitCode !== 0) {
    throw new Error(`Chrome termino con codigo ${exitCode}.\n${child.getLogs()}`);
  }
}

async function captureChromeScreenshot(url, filePath) {
  const userDataDir = path.join(
    process.env.TEMP ?? os.tmpdir(),
    `fni-manual-shot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(userDataDir, { recursive: true });

  try {
    await runChromeCommand([
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      "--window-size=1440,1400",
      "--virtual-time-budget=12000",
      `--screenshot=${filePath}`,
      url,
    ]);
  } finally {
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function printChromePdf(url, filePath) {
  await runChromeCommand([
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--hide-scrollbars",
    `--print-to-pdf=${filePath}`,
    "--print-to-pdf-no-header",
    url,
  ]);
}

function buildManualHelperHtml() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Manual helper</title>
    <style>
      body {
        margin: 0;
        font-family: Segoe UI, Arial, sans-serif;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        color: #0f172a;
      }
      .card {
        max-width: 36rem;
        border: 1px solid #dbe4ee;
        border-radius: 20px;
        padding: 24px;
        background: white;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      }
      .muted { color: #475569; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Preparando captura...</h1>
      <p class="muted">El navegador inicia sesion de prueba y luego abre la pantalla objetivo.</p>
      <script>
        (async () => {
          const params = new URLSearchParams(location.search);
          const email = params.get("email");
          const route = params.get("route") || "/";
          if (!email) {
            document.body.insertAdjacentHTML("beforeend", "<p>Falta el correo de prueba.</p>");
            return;
          }

          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password: "demo" }),
          });

          if (!response.ok) {
            document.body.insertAdjacentHTML("beforeend", "<p>No se pudo iniciar la sesion.</p>");
            return;
          }

          const user = await response.json();
          localStorage.setItem("fni_user", JSON.stringify(user));
          await new Promise((resolve) => setTimeout(resolve, 500));
          location.href = route;
        })().catch((error) => {
          document.body.insertAdjacentHTML("beforeend", "<pre>" + String(error) + "</pre>");
        });
      </script>
    </div>
  </body>
</html>`;
}

async function buildHtml() {
  const images = Object.fromEntries(
    await Promise.all(
      screenshots.map(async (shot) => {
        const buffer = await readFile(path.join(assetDir, shot.file));
        return [shot.file, `data:image/png;base64,${buffer.toString("base64")}`];
      })
    )
  );

  const card = (shot) => `
    <figure class="shot">
      <img src="${images[shot.file]}" alt="${escapeHtml(shot.title)}" />
      <figcaption>
        <strong>${escapeHtml(shot.title)}</strong>
        <span>${escapeHtml(shot.caption)}</span>
      </figcaption>
    </figure>
  `;

  const byPrefix = (prefix) => screenshots.filter((shot) => shot.file.startsWith(prefix)).map(card).join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Manual de usuario - FNI Portal</title>
    <style>
      @page {
        size: A4;
        margin: 16mm 14mm 18mm;
      }

      :root {
        --ink: #0f172a;
        --muted: #475569;
        --border: #dbe4ee;
        --bg: #f8fafc;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: white;
        line-height: 1.5;
      }
      .page { page-break-after: always; }
      .cover {
        min-height: 250mm;
        display: grid;
        align-items: center;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .cover-card, .section {
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 18px;
        background: white;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 30px; line-height: 1.08; letter-spacing: -0.04em; }
      h2 { font-size: 20px; margin-bottom: 10px; }
      h3 { font-size: 14px; margin-bottom: 6px; }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #1d4ed8;
        font-weight: 700;
      }
      .muted { color: var(--muted); }
      .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .badge {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        color: var(--muted);
        background: #fff;
      }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .shot {
        margin: 0;
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        background: white;
        break-inside: avoid;
      }
      .shot img { width: 100%; display: block; }
      .shot figcaption {
        padding: 12px 14px 14px;
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--muted);
      }
      .shot strong { color: var(--ink); font-size: 13px; }
      ul { margin: 10px 0 0 18px; padding: 0; }
      li { margin: 0 0 6px; }
      .gallery { display: grid; gap: 14px; }
      .note { font-size: 11px; color: #64748b; margin-top: 12px; }
      .step-list {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }
      .step {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 10px;
        align-items: start;
      }
      .step .num {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #0f172a;
        color: white;
        font-size: 12px;
        display: grid;
        place-items: center;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <section class="cover page">
      <div class="cover-card">
        <div class="eyebrow">FNI Portal</div>
        <h1>Manual de usuario con capturas</h1>
        <p class="muted" style="margin-top:10px; max-width: 72ch;">
          Guia rapida para usar la plataforma segun el perfil activo: colegio, fundacion o administracion.
          Incluye capturas reales para entrenamiento, soporte y revision operativa.
        </p>
        <div class="badge-row">
          <span class="badge">Acceso por rol</span>
          <span class="badge">Evaluacion FNI</span>
          <span class="badge">Revision y documentos</span>
          <span class="badge">Usuarios, sesiones y auditoria</span>
        </div>
        <div style="margin-top:18px;">${card(screenshots[0])}</div>
      </div>
    </section>

    <section class="page">
      <div class="section">
        <div class="eyebrow">1. Uso general</div>
        <h2>Como entrar y moverse en la plataforma</h2>
        <div class="grid-2" style="margin-top:14px;">
          <div>
            <h3>Ingreso</h3>
            <div class="step-list">
              <div class="step"><div class="num">1</div><div>Escribe tu correo institucional y tu contrasena.</div></div>
              <div class="step"><div class="num">2</div><div>Presiona <strong>Ingresar</strong>.</div></div>
              <div class="step"><div class="num">3</div><div>La app te lleva automaticamente al panel segun tu rol.</div></div>
              <div class="step"><div class="num">4</div><div>Si olvidaste tu clave, usa la opcion de recuperacion desde la pantalla de ingreso.</div></div>
            </div>
          </div>
          <div>
            <h3>Navegacion</h3>
            <ul>
              <li>El menu lateral cambia segun el perfil.</li>
              <li><strong>Salir</strong> cierra la sesion activa.</li>
              <li><strong>Seguridad</strong> permite gestionar la contrasena propia.</li>
              <li>Si ves una ruta bloqueada, probablemente no corresponde a tu rol.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="section" style="margin-top:14px;">
        <h2>Captura de ingreso</h2>
        <div class="gallery">${card(screenshots[0])}</div>
      </div>
    </section>

    <section class="page">
      <div class="section">
        <div class="eyebrow">2. Colegio</div>
        <h2>Flujo para un usuario de colegio</h2>
        <div class="grid-2" style="margin-top:14px;">
          <div>
            <h3>Que debe hacer</h3>
            <ul>
              <li>Revisar el dashboard del ciclo activo.</li>
              <li>Completar la evaluacion FNI con respuestas visibles.</li>
              <li>Subir y verificar documentos PDF.</li>
              <li>Corregir observaciones antes de enviar o cerrar el trabajo.</li>
            </ul>
          </div>
          <div>
            <h3>Recomendaciones</h3>
            <ul>
              <li>Guarda frecuentemente los cambios.</li>
              <li>No completes preguntas que no aparezcan en pantalla.</li>
              <li>Verifica que los documentos subidos correspondan al ciclo correcto.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="gallery" style="margin-top:14px;">${byPrefix("school-")}</div>
    </section>

    <section class="page">
      <div class="section">
        <div class="eyebrow">3. Fundacion</div>
        <h2>Flujo para revision y seguimiento</h2>
        <div class="grid-2" style="margin-top:14px;">
          <div>
            <h3>Que revisar</h3>
            <ul>
              <li>Dashboard operativo del ciclo.</li>
              <li>Listado de colegios con filtros y estado.</li>
              <li>Revision de indicadores, observaciones y bloqueos.</li>
              <li>Catalogo FNI como referencia de criterios.</li>
            </ul>
          </div>
          <div>
            <h3>Buenas practicas</h3>
            <ul>
              <li>Prioriza colegios con menos avance o con bloqueos.</li>
              <li>Deja observaciones claras y accionables.</li>
              <li>Revisa el ciclo activo antes de editar o aprobar.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="gallery" style="margin-top:14px;">${byPrefix("foundation-")}</div>
    </section>

    <section class="page">
      <div class="section">
        <div class="eyebrow">4. Administracion</div>
        <h2>Gestion operativa del sistema</h2>
        <div class="grid-2" style="margin-top:14px;">
          <div>
            <h3>Funciones principales</h3>
            <ul>
              <li>Monitorear usuarios, sesiones y actividad.</li>
              <li>Administrar ciclos y su estado operativo.</li>
              <li>Hacer seguimiento de eventos y trazabilidad.</li>
              <li>Apoyar la gestion de contrasenas o accesos.</li>
            </ul>
          </div>
          <div>
            <h3>Consejos</h3>
            <ul>
              <li>Verifica siempre la fecha y el ciclo antes de cerrar o reabrir.</li>
              <li>Usa auditoria para confirmar cambios sensibles.</li>
              <li>Restablece contrasenas solo cuando corresponda.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="gallery" style="margin-top:14px;">${byPrefix("admin-")}</div>
    </section>

    <section class="page">
      <div class="section">
        <div class="eyebrow">5. Ayuda rapida</div>
        <h2>Problemas comunes</h2>
        <ul>
          <li>No puedo entrar: verifica correo, contrasena y rol correcto.</li>
          <li>No veo una pantalla: esa seccion puede no estar permitida para tu perfil.</li>
          <li>Un documento no sube: confirma que sea PDF y vuelve a intentarlo.</li>
          <li>La pagina quedo atrasada: recarga la vista o vuelve a iniciar sesion.</li>
        </ul>
        <p class="note">
          Si la interfaz cambia, vuelve a generar este PDF para conservar las capturas actualizadas.
        </p>
      </div>
    </section>
  </body>
</html>`;
}

async function main() {
  await mkdir(assetDir, { recursive: true });

  try {
    await access(path.join(distDir, "index.html"));
  } catch {
    throw new Error("No existe dist/. Ejecuta primero `npm run build`.");
  }

  const apiPort = await getFreePort();
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const apiServer = await spawnProcess(process.execPath, ["server/api-server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      FNI_API_STORAGE: "json",
      FNI_SERVE_STATIC: "true",
      FNI_STATIC_DIR: distDir,
      FNI_API_PORT: String(apiPort),
    },
  });

  try {
    await waitForHttp(`${apiBaseUrl}/api/health`);

    const helperPath = path.join(distDir, "manual-helper.html");
    await writeFile(helperPath, buildManualHelperHtml(), "utf8");

    const helperUrl = (email, route) =>
      `${apiBaseUrl}/manual-helper.html?email=${encodeURIComponent(email)}&route=${encodeURIComponent(route)}`;

    const capturePlan = [
      { file: "login.png", url: `${apiBaseUrl}/login` },
      { file: "admin-dashboard.png", url: helperUrl("ebravo@outlook.cl", "/admin") },
      { file: "admin-users.png", url: helperUrl("ebravo@outlook.cl", "/admin/users") },
      { file: "admin-audit.png", url: helperUrl("ebravo@outlook.cl", "/admin/audit") },
      { file: "foundation-dashboard.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/dashboard?cycleId=2026") },
      { file: "foundation-schools.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools?cycleId=2026") },
      { file: "foundation-review.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools/sch_1/review?cycleId=2026") },
      { file: "foundation-catalog.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/catalog?cycleId=2026") },
      { file: "school-dashboard.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/dashboard?cycleId=2026&schoolId=sch_1") },
      { file: "school-evaluation.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/evaluation?cycleId=2026&schoolId=sch_1") },
      { file: "school-documents.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/documents?cycleId=2026&schoolId=sch_1") },
    ];

    for (const shot of capturePlan) {
      await captureChromeScreenshot(shot.url, path.join(assetDir, shot.file));
    }

    const html = await buildHtml();
    await writeFile(htmlPath, html, "utf8");
    await printChromePdf(pathToFileURL(htmlPath).href, pdfPath);

    console.log(`Manual generado en ${pdfPath}`);
  } finally {
    if (apiServer && !apiServer.killed) {
      apiServer.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
