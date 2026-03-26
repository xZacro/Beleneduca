import "dotenv/config";

import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApiDataDir } from "../../server/fni-data-dir.mjs";
import { createPrismaClient } from "../../server/prisma-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..");
const dataDir = resolveApiDataDir();
const mode = String(process.argv[2] ?? process.env.FNI_API_STORAGE ?? "json").trim().toLowerCase();

if (!["json", "prisma"].includes(mode)) {
  throw new Error(`Modo de backup no soportado: ${mode}. Usa json o prisma.`);
}

function buildTimestampSlug() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(sourcePath, targetPath) {
  if (!(await exists(sourcePath))) {
    return false;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, {
    force: true,
    recursive: true,
  });
  return true;
}

async function exportJsonBackup(targetDir) {
  const copied = await copyIfExists(dataDir, path.join(targetDir, "api-data"));

  return {
    storage: "json",
    copiedDataDir: copied,
    sourceDataDir: dataDir,
  };
}

async function exportPrismaBackup(targetDir) {
  const prisma = createPrismaClient();

  try {
    await prisma.$connect();

    const [
      users,
      userRoles,
      schools,
      cycles,
      areas,
      indicators,
      workspaces,
      responses,
      reviews,
      sessions,
      auditEvents,
    ] = await Promise.all([
      prisma.user.findMany({ orderBy: { email: "asc" } }),
      prisma.userRole.findMany({ orderBy: [{ userId: "asc" }, { role: "asc" }] }),
      prisma.school.findMany({ orderBy: { code: "asc" } }),
      prisma.cycle.findMany({ orderBy: { id: "asc" } }),
      prisma.area.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.indicator.findMany({ orderBy: [{ areaId: "asc" }, { sortOrder: "asc" }] }),
      prisma.fniWorkspace.findMany({ orderBy: [{ cycleId: "asc" }, { schoolId: "asc" }] }),
      prisma.indicatorResponse.findMany({ orderBy: [{ workspaceId: "asc" }, { indicatorId: "asc" }] }),
      prisma.indicatorReview.findMany({ orderBy: [{ workspaceId: "asc" }, { indicatorId: "asc" }] }),
      prisma.userSession.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.auditEvent.findMany({ orderBy: { at: "desc" } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      storage: "prisma",
      counts: {
        users: users.length,
        userRoles: userRoles.length,
        schools: schools.length,
        cycles: cycles.length,
        areas: areas.length,
        indicators: indicators.length,
        workspaces: workspaces.length,
        responses: responses.length,
        reviews: reviews.length,
        sessions: sessions.length,
        auditEvents: auditEvents.length,
      },
      tables: {
        users,
        userRoles,
        schools,
        cycles,
        areas,
        indicators,
        workspaces,
        responses,
        reviews,
        sessions,
        auditEvents,
      },
    };

    await writeFile(path.join(targetDir, "database.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const copiedDocuments = await copyIfExists(path.join(dataDir, "documents"), path.join(targetDir, "documents"));
    const copiedDocumentMetadata = await copyIfExists(
      path.join(dataDir, "documents.json"),
      path.join(targetDir, "documents.json")
    );

    return {
      storage: "prisma",
      sourceDataDir: dataDir,
      copiedDocuments,
      copiedDocumentMetadata,
      counts: payload.counts,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const backupId = `${buildTimestampSlug()}-${mode}`;
  const targetDir = path.join(workspaceRoot, "backups", backupId);

  await mkdir(targetDir, { recursive: true });

  const summary =
    mode === "prisma" ? await exportPrismaBackup(targetDir) : await exportJsonBackup(targetDir);

  const manifest = {
    id: backupId,
    mode,
    createdAt: new Date().toISOString(),
    outputDir: targetDir,
    summary,
  };

  await writeFile(path.join(targetDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupId,
        mode,
        outputDir: targetDir,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("No se pudo generar el backup operativo:", error);
  process.exit(1);
});
