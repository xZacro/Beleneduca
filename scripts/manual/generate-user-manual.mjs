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
  { file: "admin-dashboard.png", title: "Panel administrativo", caption: "Centro de control con ciclos, colegios y accesos." },
  { file: "admin-users.png", title: "Usuarios", caption: "Creacion, edicion y restablecimiento de contrasenas." },
  { file: "admin-sessions.png", title: "Accesos", caption: "Sesiones activas, ultimos ingresos y revocaciones." },
  { file: "admin-audit.png", title: "Actividad", caption: "Trazabilidad de cambios, ingresos y salidas." },
  { file: "indicator-detail.png", title: "Detalle de indicador", caption: "Edicion del catalogo por parte de administracion." },
  { file: "foundation-dashboard.png", title: "Dashboard fundacion", caption: "Vista operativa del ciclo y sus colegios." },
  { file: "foundation-schools.png", title: "Colegios", caption: "Listado filtrable por estado, avance y bloqueos." },
  { file: "foundation-form.png", title: "Formulario del colegio", caption: "Vista completa de respuestas, evidencia y archivos." },
  { file: "foundation-documents.png", title: "Documentos del colegio", caption: "Biblioteca de evidencias y estado documental." },
  { file: "foundation-review.png", title: "Revision del colegio", caption: "Revision con observaciones, aprobaciones y bloqueos." },
  { file: "foundation-catalog.png", title: "Catalogo FNI", caption: "Areas e indicadores de referencia." },
  { file: "school-dashboard.png", title: "Dashboard colegio", caption: "Resumen de avance, feedback y siguientes pasos." },
  { file: "school-evaluation.png", title: "Evaluacion FNI", caption: "Formulario para responder, adjuntar PDF y enviar." },
  { file: "school-documents.png", title: "Documentos del colegio", caption: "Listado de evidencias, referencias y descargas." },
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

function roleTheme(role) {
  if (role === "ADMIN") {
    return {
      accent: "#1d4ed8",
      accentSoft: "#eff6ff",
      accentSoft2: "#dbeafe",
      accentDeep: "#172554",
      tint: "rgba(29, 78, 216, 0.16)",
    };
  }

  if (role === "FUNDACION") {
    return {
      accent: "#0f766e",
      accentSoft: "#ecfdf5",
      accentSoft2: "#d1fae5",
      accentDeep: "#134e4a",
      tint: "rgba(15, 118, 110, 0.16)",
    };
  }

  return {
    accent: "#b45309",
    accentSoft: "#fffbeb",
    accentSoft2: "#fde68a",
    accentDeep: "#92400e",
    tint: "rgba(180, 83, 9, 0.16)",
  };
}

function htmlList(items) {
  return `<ul class="manual-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function htmlButtonGuide(items) {
  return `<div class="manual-button-list">${items
    .map(
      (item) => `
        <div class="manual-button-row">
          <div class="manual-button-label">${escapeHtml(item.label)}</div>
          <div class="manual-button-text">${escapeHtml(item.description)}</div>
        </div>`
    )
    .join("")}</div>`;
}

function htmlSteps(items) {
  return `<div class="manual-step-list">${items
    .map(
      (item, index) => `
        <div class="manual-step">
          <div class="manual-step-num">${index + 1}</div>
          <div class="manual-step-text">${escapeHtml(item)}</div>
        </div>`
    )
    .join("")}</div>`;
}

function manualFigure(imageSrc, shot) {
  return `
    <figure class="manual-shot">
      <img src="${imageSrc}" alt="${escapeHtml(shot.title)}" />
      <figcaption>
        <strong>${escapeHtml(shot.title)}</strong>
        <span>${escapeHtml(shot.caption)}</span>
      </figcaption>
    </figure>
  `;
}

function buildSectionHtml(section, images) {
  const image = manualFigure(images[section.screenshot], screenshots.find((shot) => shot.file === section.screenshot));
  return `
    <section class="manual-page page">
      <div class="manual-section">
        <div class="manual-eyebrow">${escapeHtml(section.eyebrow)}</div>
        <h2>${escapeHtml(section.title)}</h2>
        <p class="manual-intro">${escapeHtml(section.summary)}</p>

        <div class="manual-grid">
          <div class="manual-panel">
            <h3>Para qué sirve esta pantalla</h3>
            ${htmlList(section.purpose)}

            <h3>Botones y controles</h3>
            ${htmlButtonGuide(section.buttons)}

            <h3>Paso a paso</h3>
            ${htmlSteps(section.steps)}

            ${
              section.note
                ? `<div class="manual-callout">${escapeHtml(section.note)}</div>`
                : ""
            }
          </div>

          <div class="manual-figure-wrap">
            ${image}
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildManualHtml(manual, images) {
  const theme = roleTheme(manual.role);
  const sectionsHtml = manual.sections.map((section) => buildSectionHtml(section, images)).join("");
  const hero = manualFigure(images[manual.heroScreenshot], screenshots.find((shot) => shot.file === manual.heroScreenshot));

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(manual.title)}</title>
    <style>
      @page {
        size: A4;
        margin: 14mm 13mm 16mm;
      }

      :root {
        --ink: #0f172a;
        --muted: #475569;
        --border: #d8e1eb;
        --paper: #ffffff;
        --bg: #f8fafc;
        --accent: ${theme.accent};
        --accent-soft: ${theme.accentSoft};
        --accent-soft-2: ${theme.accentSoft2};
        --accent-deep: ${theme.accentDeep};
        --accent-tint: ${theme.tint};
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        color: var(--ink);
        line-height: 1.65;
        font-size: 15px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 {
        font-size: 34px;
        line-height: 1.06;
        letter-spacing: -0.04em;
      }
      h2 {
        font-size: 24px;
        line-height: 1.15;
        margin-bottom: 10px;
      }
      h3 {
        font-size: 16px;
        line-height: 1.2;
        margin: 18px 0 8px;
      }
      .page {
        page-break-after: always;
        break-after: page;
      }
      .cover {
        min-height: 258mm;
        display: grid;
        align-items: center;
      }
      .cover-card,
      .manual-section {
        border: 1px solid var(--border);
        border-radius: 28px;
        background: var(--paper);
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
      }
      .cover-card {
        padding: 26px;
      }
      .manual-section {
        padding: 18px;
      }
      .manual-eyebrow {
        font-size: 11px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 800;
      }
      .manual-subtitle {
        margin-top: 10px;
        font-size: 17px;
        color: var(--muted);
        max-width: 72ch;
      }
      .manual-role-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        border-radius: 999px;
        padding: 8px 14px;
        background: var(--accent-soft);
        color: var(--accent-deep);
        font-size: 13px;
        font-weight: 700;
      }
      .manual-role-pill::before {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
      }
      .manual-cover-grid {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 18px;
        margin-top: 18px;
      }
      .manual-summary-card,
      .manual-tip-card,
      .manual-panel {
        border: 1px solid var(--border);
        border-radius: 22px;
        background: #fff;
      }
      .manual-summary-card {
        padding: 18px;
      }
      .manual-summary-title {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent-deep);
      }
      .manual-list {
        margin: 12px 0 0 18px;
        padding: 0;
      }
      .manual-list li {
        margin: 0 0 8px;
      }
      .manual-checklist {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }
      .manual-check {
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--accent-soft);
        border: 1px solid var(--accent-soft-2);
        color: var(--ink);
      }
      .manual-check strong {
        display: block;
        margin-bottom: 2px;
        color: var(--accent-deep);
      }
      .manual-shot {
        margin: 0;
        overflow: hidden;
        border-radius: 22px;
        border: 1px solid var(--border);
        background: #fff;
      }
      .manual-shot img {
        width: 100%;
        display: block;
      }
      .manual-shot figcaption {
        padding: 12px 14px 14px;
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--muted);
      }
      .manual-shot figcaption strong {
        font-size: 13px;
        color: var(--ink);
      }
      .manual-grid {
        display: grid;
        grid-template-columns: 1.04fr 0.96fr;
        gap: 16px;
        align-items: start;
      }
      .manual-panel {
        padding: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      }
      .manual-panel ul {
        margin-top: 10px;
      }
      .manual-button-list {
        display: grid;
        gap: 10px;
      }
      .manual-button-row {
        display: grid;
        grid-template-columns: minmax(128px, 148px) 1fr;
        gap: 12px;
        align-items: start;
        padding: 11px 12px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: #fff;
      }
      .manual-button-label {
        border-radius: 999px;
        padding: 6px 10px;
        background: var(--accent-soft);
        color: var(--accent-deep);
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
      }
      .manual-button-text {
        color: var(--muted);
        font-size: 13px;
      }
      .manual-step-list {
        display: grid;
        gap: 10px;
      }
      .manual-step {
        display: grid;
        grid-template-columns: 36px 1fr;
        gap: 12px;
        align-items: start;
        padding: 10px 12px;
        border-radius: 16px;
        background: #fff;
        border: 1px solid var(--border);
      }
      .manual-step-num {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: var(--accent);
        color: white;
        display: grid;
        place-items: center;
        font-weight: 800;
      }
      .manual-step-text {
        color: var(--ink);
      }
      .manual-callout {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--accent-soft);
        border: 1px solid var(--accent-soft-2);
        color: var(--accent-deep);
      }
      .manual-figure-wrap {
        position: sticky;
        top: 12px;
      }
      .manual-footer {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 18px;
        background: #f8fafc;
        border: 1px dashed var(--border);
        color: var(--muted);
        font-size: 13px;
      }
      .manual-small-print {
        margin-top: 10px;
        font-size: 12px;
        color: #64748b;
      }
      .manual-quick-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-top: 16px;
      }
      .manual-quick-card {
        padding: 14px;
        border-radius: 18px;
        background: #fff;
        border: 1px solid var(--border);
      }
      .manual-quick-card strong {
        display: block;
        margin-bottom: 6px;
        color: var(--accent-deep);
      }
      .manual-quick-card span {
        color: var(--muted);
        font-size: 13px;
      }
      .manual-hero-copy {
        color: var(--muted);
        font-size: 15px;
        max-width: 68ch;
      }
      .manual-toc {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }
      .manual-toc-item {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid var(--border);
      }
      .manual-toc-item .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
      }
      .manual-toc-item span {
        color: var(--muted);
        font-size: 13px;
      }
      .manual-hero-grid {
        display: grid;
        grid-template-columns: 1fr 0.92fr;
        gap: 18px;
        margin-top: 18px;
      }
      .manual-kicker {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.24em;
        color: var(--accent);
        font-weight: 800;
      }
      .manual-cover-title {
        margin-top: 8px;
      }
      .manual-cover-note {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        background: linear-gradient(180deg, var(--accent-soft) 0%, #fff 100%);
        border: 1px solid var(--accent-soft-2);
        color: var(--accent-deep);
      }
      .manual-section .manual-intro {
        color: var(--muted);
        margin-bottom: 14px;
        max-width: 72ch;
      }
      @media print {
        .manual-figure-wrap { position: static; }
      }
    </style>
  </head>
  <body>
    <section class="cover page">
      <div class="cover-card">
        <div class="manual-kicker">FNI Portal</div>
        <div class="manual-role-pill">${escapeHtml(manual.roleLabel)}</div>
        <h1 class="manual-cover-title">${escapeHtml(manual.title)}</h1>
        <p class="manual-subtitle">${escapeHtml(manual.subtitle)}</p>

        <div class="manual-cover-grid">
          <div class="manual-summary-card">
            <div class="manual-summary-title">Lo que aprenderá</div>
            ${htmlList(manual.learningGoals)}

            <div class="manual-cover-note">
              <strong>Consejo para personas que usan la plataforma por primera vez</strong>
              <div style="margin-top:6px;">
                Lea una sección completa antes de hacer clic. En esta plataforma casi todo se guarda
                al momento, por eso es mejor ir paso a paso y esperar a que termine de cargar cada pantalla.
              </div>
            </div>

            <div class="manual-quick-grid">
              ${manual.quickCards
                .map(
                  (item) => `
                    <div class="manual-quick-card">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.text)}</span>
                    </div>`
                )
                .join("")}
            </div>
          </div>

          <div>
            ${hero}
            <div class="manual-footer">
              Este manual usa el mismo estilo visual en todas sus secciones para que la lectura sea
              más cómoda. Las capturas muestran la pantalla real del sistema con botones y textos visibles.
            </div>
          </div>
        </div>

        <div class="manual-summary-card" style="margin-top:18px;">
          <div class="manual-summary-title">Índice rápido</div>
          <div class="manual-toc">
            ${manual.sections
              .map(
                (section) => `
                  <div class="manual-toc-item">
                    <div class="dot"></div>
                    <div>
                      <div style="font-weight:700;color:var(--ink);">${escapeHtml(section.title)}</div>
                      <span>${escapeHtml(section.summary)}</span>
                    </div>
                  </div>`
              )
              .join("")}
          </div>
        </div>
      </div>
    </section>

    ${sectionsHtml}

    <section class="page">
      <div class="manual-section">
        <div class="manual-eyebrow">Apoyo final</div>
        <h2>Qué hacer si algo se ve distinto</h2>
        <p class="manual-intro">
          La plataforma puede cambiar con el tiempo. Si usted ve un botón o un orden diferente,
          use esta guía como referencia general y siga siempre estos pasos cortos.
        </p>

        <div class="manual-panel">
          ${htmlSteps([
            "Verifique que inició sesión con el perfil correcto.",
            "Recargue la página y espere unos segundos antes de volver a intentar.",
            "Si un botón no aparece, puede que su rol no tenga permiso para esa acción.",
            "Si carga un PDF, confirme que el archivo sea realmente PDF y que no esté dañado.",
            "Si no está seguro, detenga el cambio y pida apoyo antes de cerrar o aprobar algo.",
          ])}
        </div>

        <div class="manual-callout" style="margin-top:16px;">
          Sugerencia práctica: si la letra se ve pequeña, use el zoom del navegador con <strong>Ctrl + +</strong>.
          Para volver al tamaño normal, use <strong>Ctrl + 0</strong>.
        </div>

        <div class="manual-small-print">
          Manual generado automáticamente a partir de capturas del sistema para el perfil ${escapeHtml(manual.roleLabel)}.
        </div>
      </div>
    </section>
  </body>
</html>`;
}

function buildManualConfigs() {
  return [
    {
      slug: "manual-administrador",
      role: "ADMIN",
      roleLabel: "Administrador",
      title: "Manual de usuario para Administrador",
      subtitle:
        "Guía paso a paso para revisar usuarios, accesos, actividad y el catálogo del sistema con una lectura clara y ordenada.",
      heroScreenshot: "admin-dashboard.png",
      learningGoals: [
        "Entrar al sistema y llegar al panel administrativo sin confundirse de perfil.",
        "Crear, editar y restablecer usuarios con pasos claros.",
        "Revisar sesiones y actividad para detectar movimientos importantes.",
        "Abrir el catálogo FNI y entender cuándo un cambio es editable.",
      ],
      quickCards: [
        { title: "Botón clave", text: "Refrescar vuelve a cargar la información actual." },
        { title: "Seguridad", text: "No comparta claves ni deje sesiones abiertas." },
        { title: "Cambio seguro", text: "Revise dos veces antes de guardar o aprobar." },
      ],
      sections: [
        {
          eyebrow: "1. Inicio de sesión",
          title: "Entrar al sistema",
          summary:
            "Use su correo y contraseña para llegar al panel de Administración y confirmar que abrió la sesión correcta.",
          screenshot: "login.png",
          purpose: [
            "La pantalla sirve para iniciar sesión con su cuenta institucional.",
            "También permite pedir ayuda si olvidó la contraseña.",
            "Después de ingresar, el sistema lo lleva automáticamente al panel de Administrador.",
          ],
          buttons: [
            { label: "Ingresar", description: "Abre la sesión con el correo y la contraseña escritos." },
            { label: "Recuperar contraseña", description: "Muestra el formulario para pedir apoyo a administración." },
            { label: "Mostrar clave", description: "Permite revisar la contraseña antes de entrar." },
          ],
          steps: [
            "Escriba su correo institucional.",
            "Escriba su contraseña.",
            "Presione Ingresar y espere la carga del panel.",
            "Si no recuerda la clave, use Recuperar contraseña antes de insistir varias veces.",
          ],
          note:
            "Si el sistema no lo lleva al panel correcto, revise que esté usando la cuenta de administrador y no una cuenta de fundación o colegio.",
        },
        {
          eyebrow: "2. Panel administrativo",
          title: "Revisar el tablero principal",
          summary:
            "Este tablero resume los ciclos, colegios, accesos y atajos más usados por administración.",
          screenshot: "admin-dashboard.png",
          purpose: [
            "Le muestra la foto general del sistema.",
            "Permite entrar rápido a usuarios, actividad y colegios.",
            "Ayuda a decidir qué revisar primero sin perderse entre menús.",
          ],
          buttons: [
            { label: "Nuevo ciclo", description: "Crea un ciclo cuando comienza un nuevo periodo de trabajo." },
            { label: "Ver colegios", description: "Lleva al listado de colegios para revisar estado y avance." },
            { label: "Usuarios", description: "Abre la gestión de cuentas." },
            { label: "Actividad", description: "Muestra la trazabilidad de cambios y accesos." },
            { label: "Salir", description: "Cierra la sesión activa." },
          ],
          steps: [
            "Revise la tarjeta de totales para entender el estado general.",
            "Use el selector de ciclo si necesita ver otro periodo.",
            "Entre primero a Usuarios si necesita ayudar a una persona con acceso.",
            "Use Ver colegios cuando necesite revisar el avance operativo.",
          ],
          note:
            "El panel le sirve como punto de partida. Si no sabe dónde entrar, empiece aquí y siga el menú lateral según la tarea.",
        },
        {
          eyebrow: "3. Usuarios",
          title: "Crear, editar y restablecer cuentas",
          summary:
            "Aquí administra personas, roles y contraseñas. Es la pantalla que más usan los equipos de apoyo y control.",
          screenshot: "admin-users.png",
          purpose: [
            "Le permite crear un usuario nuevo con su rol correcto.",
            "Sirve para cambiar estado, roles y colegio asociado.",
            "También permite restablecer una contraseña sin borrar la cuenta.",
          ],
          buttons: [
            { label: "Nuevo usuario", description: "Limpia el formulario para registrar una cuenta nueva." },
            { label: "Refrescar", description: "Vuelve a cargar la lista y los colegios." },
            { label: "Crear usuario", description: "Guarda una cuenta nueva con el formulario de la derecha." },
            { label: "Restablecer contraseña", description: "Asigna una nueva clave al usuario seleccionado." },
          ],
          steps: [
            "Busque el usuario por nombre o correo.",
            "Si va a crear uno nuevo, presione Nuevo usuario.",
            "Escriba nombre, correo, rol y estado.",
            "Si el rol es Colegio, seleccione el colegio correspondiente.",
            "Presione Crear usuario o Guardar cambios.",
            "Si la persona olvidó su clave, use Restablecer contraseña.",
          ],
          note:
            "Para usuarios de colegio, no olvide asociar un establecimiento. Si ese campo queda vacío, el usuario puede quedar mal configurado.",
        },
        {
          eyebrow: "4. Sesiones",
          title: "Ver quién está conectado",
          summary:
            "Esta pantalla ayuda a detectar inicios de sesión recientes, sesiones activas y accesos que ya no deberían estar abiertos.",
          screenshot: "admin-sessions.png",
          purpose: [
            "Le muestra quién ingresó y desde qué navegador.",
            "Sirve para revisar actividad reciente de forma rápida.",
            "Ayuda a detectar sesiones pausadas, revocadas o inusuales.",
          ],
          buttons: [
            { label: "Refrescar", description: "Actualiza la lista de sesiones." },
          ],
          steps: [
            "Escriba un nombre, correo, IP o navegador en Buscar.",
            "Use el filtro Estado para ver solo sesiones activas o revocadas.",
            "Revise la columna Última actividad para saber si la sesión sigue viva.",
            "Use esta pantalla cuando alguien diga que quedó conectado en otro equipo.",
          ],
          note:
            "Esta pantalla no cambia datos por sí sola. Sirve para observación y control operativo.",
        },
        {
          eyebrow: "5. Actividad",
          title: "Revisar trazabilidad y cambios",
          summary:
            "Aquí se registran ingresos, salidas, cambios de datos y acciones sensibles del sistema.",
          screenshot: "admin-audit.png",
          purpose: [
            "Permite confirmar qué pasó y cuándo pasó.",
            "Ayuda a buscar cambios por usuario, evento o detalle.",
            "Sirve como respaldo cuando un equipo necesita verificar una acción.",
          ],
          buttons: [
            { label: "Refrescar", description: "Trae la auditoría más reciente." },
          ],
          steps: [
            "Use el buscador para encontrar un correo, un rol o una palabra clave.",
            "Aplique el filtro Evento si necesita ver solo ingresos, salidas o cambios.",
            "Revise la columna de detalle para entender qué se modificó.",
            "Use esta pantalla cuando necesite confirmar una operación sensible.",
          ],
          note:
            "Si el evento no aparece, puede que todavía no haya sincronizado. Presione Refrescar y vuelva a revisar.",
        },
        {
          eyebrow: "6. Catálogo FNI",
          title: "Entender y modificar indicadores",
          summary:
            "El catálogo reúne las áreas e indicadores. Desde aquí administración puede mantener los nombres, el orden y el estado.",
          screenshot: "indicator-detail.png",
          purpose: [
            "Muestra el detalle de un indicador del catálogo.",
            "Permite editar nombre, orden y estado cuando el usuario tiene rol Admin.",
            "Ayuda a mantener la evaluación alineada con la estructura oficial.",
          ],
          buttons: [
            { label: "Volver", description: "Regresa al listado del catálogo." },
            { label: "Guardar cambios", description: "Guarda el nombre, el orden y el estado del indicador." },
          ],
          steps: [
            "Entre al catálogo y busque el indicador que desea revisar.",
            "Abra el detalle haciendo clic en la fila del indicador.",
            "Cambie el nombre, el orden o el estado solo si está seguro.",
            "Presione Guardar cambios y espere la confirmación.",
          ],
          note:
            "Si la pantalla solo muestra 'Solo lectura', no está en una cuenta de administrador. En ese caso no podrá guardar cambios.",
        },
      ],
    },
    {
      slug: "manual-fundacion",
      role: "FUNDACION",
      roleLabel: "Fundación",
      title: "Manual de usuario para Fundación",
      subtitle:
        "Guía detallada para revisar colegios, abrir formularios, evaluar evidencias y dejar observaciones claras para cada ciclo.",
      heroScreenshot: "foundation-dashboard.png",
      learningGoals: [
        "Llegar al tablero de Fundación y entender el estado del ciclo activo.",
        "Buscar colegios por nombre, estado o avance y abrir su revisión.",
        "Leer respuestas, documentos y observaciones con calma y sin perder contexto.",
        "Usar el catálogo como referencia de áreas e indicadores.",
      ],
      quickCards: [
        { title: "Primero revise", text: "Ciclo activo, colegios con bloqueo y pendientes de revisión." },
        { title: "Botón clave", text: "Ver documentos lleva a la evidencia del colegio." },
        { title: "Regla útil", text: "Aprobar, observar o bloquear debe ir con comentario claro." },
      ],
      sections: [
        {
          eyebrow: "1. Inicio de sesión",
          title: "Entrar al sistema",
          summary:
            "Use su correo y contraseña para acceder al tablero de Fundación y ver el ciclo que le corresponde.",
          screenshot: "login.png",
          purpose: [
            "La pantalla abre el acceso con su cuenta institucional.",
            "También permite pedir recuperación de contraseña si la olvidó.",
            "Después de ingresar, el sistema lo lleva al panel de Fundación.",
          ],
          buttons: [
            { label: "Ingresar", description: "Abre la sesión con los datos escritos." },
            { label: "Recuperar contraseña", description: "Envía o prepara una solicitud de ayuda." },
            { label: "Mostrar clave", description: "Permite revisar la contraseña antes de enviarla." },
          ],
          steps: [
            "Escriba su correo institucional.",
            "Escriba su contraseña.",
            "Presione Ingresar y espere la carga del tablero.",
            "Si no recuerda la clave, use Recuperar contraseña.",
          ],
          note:
            "Si al entrar lo redirige a otro perfil, revise que la cuenta sea de Fundación y no de otro rol.",
        },
        {
          eyebrow: "2. Tablero de Fundación",
          title: "Revisar el ciclo y los colegios",
          summary:
            "Este tablero le muestra el estado general del ciclo, los colegios activos y los puntos que requieren prioridad.",
          screenshot: "foundation-dashboard.png",
          purpose: [
            "Le da una vista general del ciclo activo.",
            "Muestra cuántos colegios están activos, pendientes o bloqueados.",
            "Permite entrar rápido a colegios, catálogo y ajustes del ciclo.",
          ],
          buttons: [
            { label: "Ciclo 2026", description: "Selector para cambiar de ciclo." },
            { label: "Nuevo ciclo", description: "Abre la creación de un nuevo ciclo si corresponde." },
            { label: "Ver colegios", description: "Lleva al listado operativo de colegios." },
            { label: "Guardar configuración", description: "Guarda cambios del ciclo." },
            { label: "Cerrar ciclo", description: "Bloquea el ciclo cuando ya no deben seguir cambios." },
          ],
          steps: [
            "Revise primero el resumen superior.",
            "Cambie de ciclo solo si necesita mirar otro periodo.",
            "Use Ver colegios para entrar a un establecimiento.",
            "Si el ciclo ya no debe editarse, cierre el ciclo antes de finalizar el periodo.",
          ],
          note:
            "Cuando el ciclo está cerrado, la revisión queda solo en modo lectura. Eso evita cambios accidentales.",
        },
        {
          eyebrow: "3. Colegios",
          title: "Encontrar un colegio y filtrar su estado",
          summary:
            "La lista de colegios permite buscar por nombre, código, completitud o bloqueos para revisar primero lo más urgente.",
          screenshot: "foundation-schools.png",
          purpose: [
            "Le ayuda a localizar un colegio rápidamente.",
            "Permite ordenar por avance, actividad o bloqueos.",
            "Sirve para pasar desde la lista a formulario, revisión o documentos.",
          ],
          buttons: [
            { label: "Cards / Tabla", description: "Cambia la forma de ver la lista." },
            { label: "Refrescar", description: "Actualiza la información del ciclo." },
            { label: "Estado", description: "Filtra por pendiente, observado, aprobado o bloqueado." },
            { label: "Completitud", description: "Filtra por porcentaje de avance." },
          ],
          steps: [
            "Escriba parte del nombre o código en Buscar.",
            "Use Estado para ver solo los colegios que requieren atención.",
            "Use Completitud si necesita revisar los más atrasados.",
            "Abra la fila del colegio que desea revisar.",
          ],
          note:
            "Si necesita trabajar más rápido, empiece por los colegios bloqueados o con observaciones recientes.",
        },
        {
          eyebrow: "4. Formulario del colegio",
          title: "Leer respuestas, documentos y archivos",
          summary:
            "Esta pantalla muestra el formulario completo del colegio con respuestas, PDF de soporte y textos de referencia.",
          screenshot: "foundation-form.png",
          purpose: [
            "Sirve para revisar respuestas y comprobar si la evidencia está bien cargada.",
            "Permite abrir o quitar archivos PDF cuando su rol lo habilita.",
            "Ayuda a entender qué respondió el colegio antes de pasar a la revisión formal.",
          ],
          buttons: [
            { label: "Ver PDF", description: "Abre el documento cargado para revisar su contenido." },
            { label: "Quitar archivo", description: "Elimina el PDF si corresponde corregir la evidencia." },
            { label: "Volver a la lista", description: "Regresa al listado de colegios." },
          ],
          steps: [
            "Entre al colegio y revise los indicadores visibles.",
            "Lea el comentario y la referencia documental antes de cambiar algo.",
            "Abra el PDF si necesita comprobar el respaldo.",
            "Si algo está incorrecto, elimine el archivo o vaya a revisión para dejar observación.",
          ],
          note:
            "Cada cambio en el formulario se sincroniza con el workspace del ciclo, por eso conviene revisar antes de editar.",
        },
        {
          eyebrow: "5. Revisión del colegio",
          title: "Aprobar, observar o bloquear",
          summary:
            "La revisión es la pantalla donde Fundación deja el criterio final para cada indicador y escribe el comentario correspondiente.",
          screenshot: "foundation-review.png",
          purpose: [
            "Muestra respuestas del colegio, comentario y evidencia adjunta.",
            "Permite aprobar, observar o bloquear cada indicador.",
            "Sirve para dejar una explicación clara y entendible para el colegio.",
          ],
          buttons: [
            { label: "Volver al formulario", description: "Regresa a la vista editable del colegio." },
            { label: "Ver documentos", description: "Abre la biblioteca de evidencias." },
            { label: "Ver PDF", description: "Abre el archivo adjunto del indicador." },
            { label: "Quitar PDF", description: "Elimina el archivo cuando corresponde corregirlo." },
            { label: "Aprobar", description: "Marca el indicador como correcto." },
            { label: "Observar", description: "Deja el indicador con observación y comentario." },
            { label: "Bloquear", description: "Señala un bloqueo que impide avanzar." },
          ],
          steps: [
            "Lea la respuesta del colegio y revise la evidencia.",
            "Abra el PDF si necesita comprobar el respaldo documental.",
            "Escriba un comentario claro y específico.",
            "Elija Aprobar, Observar o Bloquear según corresponda.",
            "Repita este proceso con cada indicador que necesite revisión.",
          ],
          note:
            "Si el ciclo está cerrado, la pantalla queda solo para consulta. En ese caso no podrá editar estados ni comentarios.",
        },
        {
          eyebrow: "6. Catálogo FNI",
          title: "Usar el catálogo como referencia",
          summary:
            "El catálogo reúne áreas e indicadores para que la revisión siempre use el mismo lenguaje y orden.",
          screenshot: "foundation-catalog.png",
          purpose: [
            "Le permite buscar áreas e indicadores con comodidad.",
            "Sirve para consultar criterios de evaluación.",
            "Ayuda a entender la estructura del ciclo antes de revisar colegios.",
          ],
          buttons: [
            { label: "Áreas", description: "Muestra la lista de áreas del catálogo." },
            { label: "Indicadores", description: "Cambia a la lista de indicadores." },
            { label: "Buscar", description: "Filtra por texto o código." },
          ],
          steps: [
            "Revise primero el área que le interesa.",
            "Cambie a Indicadores cuando necesite buscar uno específico.",
            "Abra el detalle solo para consultar información adicional.",
            "Si no ve un cambio editable, recuerde que Fundación trabaja normalmente en modo lectura aquí.",
          ],
          note:
            "El catálogo le sirve como mapa de referencia. Si una persona necesita cambiar la estructura, eso se hace desde Administración.",
        },
      ],
    },
    {
      slug: "manual-colegio",
      role: "COLEGIO",
      roleLabel: "Colegio",
      title: "Manual de usuario para Colegio",
      subtitle:
        "Guía clara y paso a paso para responder la evaluación, adjuntar documentos, enviar el formulario y corregir observaciones.",
      heroScreenshot: "school-dashboard.png",
      learningGoals: [
        "Entrar al sistema y reconocer su panel de colegio.",
        "Responder la evaluación sin perder información ni confundirse de área.",
        "Adjuntar y revisar PDF de respaldo con calma.",
        "Enviar el formulario y volver a editar cuando Fundación devuelva observaciones.",
      ],
      quickCards: [
        { title: "Importante", text: "Las respuestas se guardan al instante. No busque un botón Guardar." },
        { title: "Botón clave", text: "Enviar formulario manda el trabajo a revisión." },
        { title: "Si lo devuelven", text: "Use Editar por feedback y luego vuelva a enviar." },
      ],
      sections: [
        {
          eyebrow: "1. Inicio de sesión",
          title: "Entrar a su cuenta de colegio",
          summary:
            "Use su correo y contraseña para acceder al tablero del colegio y empezar la evaluación del ciclo.",
          screenshot: "login.png",
          purpose: [
            "La pantalla abre el acceso con la cuenta del colegio.",
            "También permite pedir recuperación de contraseña si es necesario.",
            "Después de ingresar, el sistema lo lleva al tablero del colegio.",
          ],
          buttons: [
            { label: "Ingresar", description: "Entra al sistema con el correo y la clave escritos." },
            { label: "Recuperar contraseña", description: "Pide ayuda para volver a entrar." },
            { label: "Mostrar clave", description: "Permite revisar la contraseña antes de enviarla." },
          ],
          steps: [
            "Escriba su correo institucional.",
            "Escriba su contraseña.",
            "Presione Ingresar y espere el cambio de pantalla.",
            "Si olvidó su clave, use Recuperar contraseña antes de seguir intentando.",
          ],
          note:
            "Si entra con otra cuenta, puede terminar viendo un panel que no corresponde a su colegio. Revise siempre el correo antes de continuar.",
        },
        {
          eyebrow: "2. Tablero del colegio",
          title: "Ver el avance general",
          summary:
            "El tablero del colegio muestra el progreso, lo pendiente y las acciones más importantes para seguir avanzando.",
          screenshot: "school-dashboard.png",
          purpose: [
            "Le muestra el estado general del ciclo y del formulario.",
            "Sirve para revisar observaciones, bloqueos y próximos pasos.",
            "Permite entrar rápido a evaluación o documentos.",
          ],
          buttons: [
            { label: "Ver documentos", description: "Abre la biblioteca de evidencias." },
            { label: "Exportar", description: "Genera un resumen del estado actual." },
            { label: "Continuar evaluación", description: "Lleva directamente al formulario de respuestas." },
            { label: "Seguridad", description: "Permite revisar o cambiar su contraseña." },
            { label: "Salir", description: "Cierra la sesión activa." },
          ],
          steps: [
            "Revise primero el porcentaje de avance y los pendientes.",
            "Mire la sección de próximos pasos para saber qué corregir primero.",
            "Use Continuar evaluación para seguir trabajando en el formulario.",
            "Entre a Ver documentos si necesita confirmar un PDF cargado.",
          ],
          note:
            "Si ve observaciones o bloqueos, lo más útil es abrir la evaluación y corregir solo lo que Fundación señaló.",
        },
        {
          eyebrow: "3. Evaluación FNI",
          title: "Responder el formulario paso a paso",
          summary:
            "En esta pantalla se completan las preguntas por indicador, se adjuntan PDFs y se envía el formulario a revisión.",
          screenshot: "school-evaluation.png",
          purpose: [
            "Sirve para responder las preguntas de cada área.",
            "Permite cargar evidencia documental en PDF.",
            "Muestra el estado del formulario y el feedback recibido.",
          ],
          buttons: [
            { label: "Ver documentos", description: "Abre la biblioteca de evidencias sin salir de la evaluación." },
            { label: "Enviar formulario", description: "Manda el trabajo para revisión." },
            { label: "Editar por feedback", description: "Vuelve a habilitar edición cuando Fundación devolvió el formulario." },
            { label: "Volver a borrador", description: "Regresa el formulario a estado de edición." },
          ],
          steps: [
            "Elija el área desde el menú lateral izquierdo.",
            "Responda Sí, No o N/A en cada pregunta visible.",
            "Complete los campos numéricos si la pantalla los pide.",
            "Escriba la referencia documental y comentarios cuando corresponda.",
            "Adjunte un PDF si el indicador lo solicita.",
            "Cuando termine, presione Enviar formulario.",
          ],
          note:
            "No existe botón Guardar. Cada cambio queda registrado al instante, así que avance despacio y espere a que cargue cada indicador.",
        },
        {
          eyebrow: "4. Documentos",
          title: "Revisar archivos y evidencias",
          summary:
            "La biblioteca de documentos le muestra los PDF cargados, la referencia escrita y el estado de cada evidencia.",
          screenshot: "school-documents.png",
          purpose: [
            "Sirve para revisar qué archivos ya subió.",
            "Permite abrir un PDF para comprobar que sea el correcto.",
            "Ayuda a encontrar un indicador por nombre, área o comentario.",
          ],
          buttons: [
            { label: "Ir a evaluación", description: "Regresa al formulario principal." },
            { label: "Ver PDF", description: "Abre el archivo adjunto de la evidencia." },
            { label: "Área", description: "Filtra las evidencias por área." },
          ],
          steps: [
            "Use Buscar para encontrar un indicador, archivo o comentario.",
            "Filtre por Área si quiere revisar solo una parte del formulario.",
            "Abra Ver PDF cuando necesite confirmar el contenido del archivo.",
            "Vuelva a evaluación si necesita corregir algo del indicador.",
          ],
          note:
            "Si un archivo no aparece, confirme que se haya subido en formato PDF y que no esté roto o incompleto.",
        },
        {
          eyebrow: "5. Feedback y corrección",
          title: "Qué hacer si Fundación devuelve el formulario",
          summary:
            "Cuando el trabajo vuelve con observaciones, el colegio debe corregir lo indicado y reenviar el formulario.",
          screenshot: "school-dashboard.png",
          purpose: [
            "Ayuda a interpretar el feedback recibido.",
            "Recuerda que el formulario puede volver a borrador para corregir.",
            "Evita que el usuario se quede bloqueado por no ver el botón correcto.",
          ],
          buttons: [
            { label: "Editar por feedback", description: "Abre nuevamente la edición cuando el envío fue devuelto." },
            { label: "Volver a borrador", description: "Retorna a estado de edición si todavía no desea reenviar." },
            { label: "Continuar evaluación", description: "Lleva al lugar exacto donde seguir corrigiendo." },
          ],
          steps: [
            "Lea el comentario que dejó Fundación.",
            "Abra el indicador que aparece en observación o bloqueo.",
            "Corrija solo lo que se pidió y vuelva a revisar el PDF si hace falta.",
            "Envíe el formulario nuevamente cuando todo quede listo.",
          ],
          note:
            "Si no ve el botón para editar, revise primero el estado del formulario. A veces está en borrador y solo necesita seguir trabajando.",
        },
      ],
    },
  ];
}

async function readImages() {
  return Object.fromEntries(
    await Promise.all(
      screenshots.map(async (shot) => {
        const buffer = await readFile(path.join(assetDir, shot.file));
        return [shot.file, `data:image/png;base64,${buffer.toString("base64")}`];
      })
    )
  );
}

async function main() {
  await mkdir(assetDir, { recursive: true });
  const manualDataDir = path.join(
    process.env.TEMP ?? os.tmpdir(),
    `fni-manual-data-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(manualDataDir, { recursive: true });

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
      FNI_API_DATA_DIR: manualDataDir,
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
      { file: "admin-sessions.png", url: helperUrl("ebravo@outlook.cl", "/admin/sessions") },
      { file: "admin-audit.png", url: helperUrl("ebravo@outlook.cl", "/admin/audit") },
      { file: "indicator-detail.png", url: helperUrl("ebravo@outlook.cl", "/foundation/catalog/indicators/infraestructura-001") },
      { file: "foundation-dashboard.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/dashboard?cycleId=2026") },
      { file: "foundation-schools.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools?cycleId=2026") },
      { file: "foundation-form.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools/sch_1/form?cycleId=2026") },
      { file: "foundation-documents.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools/sch_1/documents?cycleId=2026") },
      { file: "foundation-review.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/schools/sch_1/review?cycleId=2026") },
      { file: "foundation-catalog.png", url: helperUrl("pedro.letelier@beleneduca.cl", "/foundation/catalog?cycleId=2026") },
      { file: "school-dashboard.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/dashboard?cycleId=2026&schoolId=sch_1") },
      { file: "school-evaluation.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/evaluation?cycleId=2026&schoolId=sch_1") },
      { file: "school-documents.png", url: helperUrl("ppontillo@beleneduca.cl", "/school/documents?cycleId=2026&schoolId=sch_1") },
    ];

    for (const shot of capturePlan) {
      await captureChromeScreenshot(shot.url, path.join(assetDir, shot.file));
    }

    const images = await readImages();
    const manuals = buildManualConfigs();

    for (const manual of manuals) {
      const html = buildManualHtml(manual, images);
      const manualHtmlPath = path.join(docsDir, `${manual.slug}.html`);
      const manualPdfPath = path.join(docsDir, `${manual.slug}.pdf`);
      await writeFile(manualHtmlPath, html, "utf8");
      await printChromePdf(pathToFileURL(manualHtmlPath).href, manualPdfPath);
      console.log(`Manual generado en ${manualPdfPath}`);
    }
  } finally {
    if (apiServer && !apiServer.killed) {
      apiServer.kill("SIGTERM");
    }
    await rm(manualDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
