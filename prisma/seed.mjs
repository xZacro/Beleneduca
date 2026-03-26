import { DEMO_SCHOOLS } from "../server/fni-domain.mjs";
import {
  DEMO_AUTH_USERS,
  PRIMARY_ADMIN_EMAIL,
  PRIMARY_SCHOOL_EMAIL,
} from "../server/fni-demo-users.mjs";
import { seedReferenceData } from "../server/fni-reference-data.mjs";
import { hashPassword, hashSessionToken } from "../server/fni-passwords.mjs";
import { createPrismaClient } from "../server/prisma-client.mjs";

const prisma = createPrismaClient();

const WORKSPACE_STATUS_2026 = [
  { reviewStatus: "IN_REVIEW", submissionStatus: "ENVIADO" },
  { reviewStatus: "PENDING", submissionStatus: "BORRADOR" },
  { reviewStatus: "OBSERVED", submissionStatus: "DEVUELTO" },
  { reviewStatus: "APPROVED", submissionStatus: "APROBADO" },
  { reviewStatus: "BLOCKED", submissionStatus: "DEVUELTO" },
  { reviewStatus: "PENDING", submissionStatus: "BORRADOR" },
  { reviewStatus: "IN_REVIEW", submissionStatus: "ENVIADO" },
  { reviewStatus: "OBSERVED", submissionStatus: "DEVUELTO" },
  { reviewStatus: "PENDING", submissionStatus: "BORRADOR" },
  { reviewStatus: "IN_REVIEW", submissionStatus: "ENVIADO" },
  { reviewStatus: "PENDING", submissionStatus: "BORRADOR" },
  { reviewStatus: "APPROVED", submissionStatus: "APROBADO" },
];

function workspaceTiming(index, cycleId) {
  const baseHours = (index + 1) * 3;
  if (cycleId === "2026") {
    return new Date(Date.now() - baseHours * 60 * 60 * 1000);
  }

  return new Date(Date.now() - (baseHours + 24 * 90) * 60 * 60 * 1000);
}

async function seedUsers() {
  const desiredEmails = DEMO_AUTH_USERS.map((user) => user.email);

  for (const demoUser of DEMO_AUTH_USERS) {
    const passwordHash = hashPassword(demoUser.password);

    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        schoolId: demoUser.schoolId,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        schoolId: demoUser.schoolId,
        passwordHash,
        status: "ACTIVE",
      },
    });

    await prisma.userRole.deleteMany({
      where: {
        userId: user.id,
        role: {
          notIn: demoUser.roles,
        },
      },
    });

    for (const role of demoUser.roles) {
      await prisma.userRole.upsert({
        where: {
          userId_role: {
            userId: user.id,
            role,
          },
        },
        update: {},
        create: {
          userId: user.id,
          role,
        },
      });
    }
  }

  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: "@demo.cl",
        notIn: desiredEmails,
      },
    },
  });
}

async function seedWorkspaces() {
  for (const [index, school] of DEMO_SCHOOLS.entries()) {
    const template2026 = WORKSPACE_STATUS_2026[index] ?? WORKSPACE_STATUS_2026[0];

    await prisma.fniWorkspace.upsert({
      where: {
        schoolId_cycleId: {
          schoolId: school.id,
          cycleId: "2026",
        },
      },
      update: {
        submissionStatus: template2026.submissionStatus,
        reviewStatus: template2026.reviewStatus,
        message:
          template2026.reviewStatus === "OBSERVED"
            ? "Quedan observaciones pendientes de resolver."
            : template2026.reviewStatus === "BLOCKED"
            ? "Existen bloqueantes que requieren atencion de fundacion."
            : "",
        submittedAt: template2026.submissionStatus !== "BORRADOR" ? workspaceTiming(index, "2026") : null,
        returnedAt:
          template2026.submissionStatus === "DEVUELTO" ? workspaceTiming(index + 1, "2026") : null,
        approvedAt:
          template2026.submissionStatus === "APROBADO" ? workspaceTiming(index + 2, "2026") : null,
        lastActivityAt: workspaceTiming(index, "2026"),
      },
      create: {
        schoolId: school.id,
        cycleId: "2026",
        submissionStatus: template2026.submissionStatus,
        reviewStatus: template2026.reviewStatus,
        message:
          template2026.reviewStatus === "OBSERVED"
            ? "Quedan observaciones pendientes de resolver."
            : template2026.reviewStatus === "BLOCKED"
            ? "Existen bloqueantes que requieren atencion de fundacion."
            : "",
        submittedAt: template2026.submissionStatus !== "BORRADOR" ? workspaceTiming(index, "2026") : null,
        returnedAt:
          template2026.submissionStatus === "DEVUELTO" ? workspaceTiming(index + 1, "2026") : null,
        approvedAt:
          template2026.submissionStatus === "APROBADO" ? workspaceTiming(index + 2, "2026") : null,
        lastActivityAt: workspaceTiming(index, "2026"),
      },
    });

    await prisma.fniWorkspace.upsert({
      where: {
        schoolId_cycleId: {
          schoolId: school.id,
          cycleId: "2025",
        },
      },
      update: {
        submissionStatus: "APROBADO",
        reviewStatus: "APPROVED",
        message: "Ciclo historico cerrado.",
        submittedAt: workspaceTiming(index, "2025"),
        approvedAt: workspaceTiming(index + 1, "2025"),
        lastActivityAt: workspaceTiming(index, "2025"),
      },
      create: {
        schoolId: school.id,
        cycleId: "2025",
        submissionStatus: "APROBADO",
        reviewStatus: "APPROVED",
        message: "Ciclo historico cerrado.",
        submittedAt: workspaceTiming(index, "2025"),
        approvedAt: workspaceTiming(index + 1, "2025"),
        lastActivityAt: workspaceTiming(index, "2025"),
      },
    });
  }
}

async function seedSampleWorkspaceData() {
  const schoolUser = await prisma.user.findUnique({ where: { email: PRIMARY_SCHOOL_EMAIL } });
  const adminUser = await prisma.user.findUnique({ where: { email: PRIMARY_ADMIN_EMAIL } });
  const workspace = await prisma.fniWorkspace.findUnique({
    where: {
      schoolId_cycleId: {
        schoolId: "sch_1",
        cycleId: "2026",
      },
    },
  });

  if (!schoolUser || !adminUser || !workspace) {
    return;
  }

  const responseRows = [
    {
      indicatorId: "infraestructura-001",
      answers: { hasDocument: "SI" },
      documentRef: "Rex-Oficial-2026.pdf",
      comments: "Documento vigente subido por el colegio.",
      fileName: "rex-oficial-2026.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 482311,
      fileStorageKey: "fni/sch_1/2026/infraestructura-001/rex-oficial-2026.pdf",
    },
    {
      indicatorId: "infraestructura-013",
      answers: { q1: "SI", q2: "NO" },
      documentRef: "acta-comite-paritario.pdf",
      comments: "Existe comite, pero falta regularidad mensual.",
      fileName: "acta-comite-paritario.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 238044,
      fileStorageKey: "fni/sch_1/2026/infraestructura-013/acta-comite-paritario.pdf",
    },
    {
      indicatorId: "asistencia-007",
      answers: { valuePct: 92 },
      documentRef: "syscol-firmas-enero.pdf",
      comments: "Se adjunta evidencia de Syscol Web.",
      fileName: "syscol-firmas-enero.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 129556,
      fileStorageKey: "fni/sch_1/2026/asistencia-007/syscol-firmas-enero.pdf",
    },
    {
      indicatorId: "temas-laborales-014",
      answers: { answer: "NO" },
      documentRef: "",
      comments: "Sin trabajadores extranjeros en el periodo.",
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
      fileStorageKey: null,
    },
    {
      indicatorId: "temas-acad-micos-017",
      answers: { answer: "SI" },
      documentRef: "plan-tp-2026.pdf",
      comments: "Formacion TP activa, pendiente reglamento vigente de practica.",
      fileName: "plan-tp-2026.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 315208,
      fileStorageKey: "fni/sch_1/2026/temas-acad-micos-017/plan-tp-2026.pdf",
    },
  ];

  for (const row of responseRows) {
    await prisma.indicatorResponse.upsert({
      where: {
        workspaceId_indicatorId: {
          workspaceId: workspace.id,
          indicatorId: row.indicatorId,
        },
      },
      update: {
        answers: row.answers,
        documentRef: row.documentRef,
        comments: row.comments,
        fileName: row.fileName,
        fileMimeType: row.fileMimeType,
        fileSizeBytes: row.fileSizeBytes,
        fileStorageKey: row.fileStorageKey,
        uploadedAt: new Date("2026-03-10T15:00:00.000Z"),
        updatedAt: new Date("2026-03-10T15:00:00.000Z"),
        updatedById: schoolUser.id,
      },
      create: {
        workspaceId: workspace.id,
        indicatorId: row.indicatorId,
        answers: row.answers,
        documentRef: row.documentRef,
        comments: row.comments,
        fileName: row.fileName,
        fileMimeType: row.fileMimeType,
        fileSizeBytes: row.fileSizeBytes,
        fileStorageKey: row.fileStorageKey,
        uploadedAt: new Date("2026-03-10T15:00:00.000Z"),
        updatedAt: new Date("2026-03-10T15:00:00.000Z"),
        updatedById: schoolUser.id,
      },
    });
  }

  const reviewRows = [
    {
      indicatorId: "infraestructura-001",
      status: "APROBADO",
      reviewComment: "Documento correcto y vigente.",
    },
    {
      indicatorId: "asistencia-007",
      status: "OBSERVADO",
      reviewComment: "Adjuntar evidencia del corte del mes actual.",
    },
    {
      indicatorId: "temas-acad-micos-017",
      status: "PENDIENTE",
      reviewComment: "Pendiente revisar soporte normativo asociado a TP.",
    },
  ];

  for (const row of reviewRows) {
    await prisma.indicatorReview.upsert({
      where: {
        workspaceId_indicatorId: {
          workspaceId: workspace.id,
          indicatorId: row.indicatorId,
        },
      },
      update: {
        status: row.status,
        reviewComment: row.reviewComment,
        reviewedAt: new Date("2026-03-12T16:30:00.000Z"),
        reviewedById: adminUser.id,
      },
      create: {
        workspaceId: workspace.id,
        indicatorId: row.indicatorId,
        status: row.status,
        reviewComment: row.reviewComment,
        reviewedAt: new Date("2026-03-12T16:30:00.000Z"),
        reviewedById: adminUser.id,
      },
    });
  }

  await prisma.userSession.upsert({
    where: { tokenHash: hashSessionToken("demo-session-admin") },
    update: {
      status: "ONLINE",
      lastSeenAt: new Date("2026-03-19T18:45:00.000Z"),
      lastLoginAt: new Date("2026-03-19T17:00:00.000Z"),
      userAgent: "Codex Desktop / demo",
    },
    create: {
      userId: adminUser.id,
      tokenHash: hashSessionToken("demo-session-admin"),
      status: "ONLINE",
      lastSeenAt: new Date("2026-03-19T18:45:00.000Z"),
      lastLoginAt: new Date("2026-03-19T17:00:00.000Z"),
      userAgent: "Codex Desktop / demo",
    },
  });

  await prisma.auditEvent.upsert({
    where: { id: "audit_demo_login_foundation" },
    update: {
      type: "LOGIN",
      at: new Date("2026-03-19T17:00:00.000Z"),
      actorUserId: adminUser.id,
      actorName: adminUser.name,
      actorEmail: adminUser.email,
      actorSchoolId: adminUser.schoolId,
      actorRoles: ["ADMIN"],
      meta: { source: "seed" },
    },
    create: {
      id: "audit_demo_login_foundation",
      type: "LOGIN",
      at: new Date("2026-03-19T17:00:00.000Z"),
      actorUserId: adminUser.id,
      actorName: adminUser.name,
      actorEmail: adminUser.email,
      actorSchoolId: adminUser.schoolId,
      actorRoles: ["ADMIN"],
      meta: { source: "seed" },
    },
  });
}

async function main() {
  await seedReferenceData(prisma);
  await seedUsers();
  await seedWorkspaces();
  await seedSampleWorkspaceData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Error ejecutando seed Prisma:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
