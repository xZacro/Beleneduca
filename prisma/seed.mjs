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

const EMPTY_WORKSPACE_2026 = {
  reviewStatus: "PENDING",
  submissionStatus: "BORRADOR",
};

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
  const workspaceIds2026 = [];

  for (const [index, school] of DEMO_SCHOOLS.entries()) {
    const workspace2026 = await prisma.fniWorkspace.upsert({
      where: {
        schoolId_cycleId: {
          schoolId: school.id,
          cycleId: "2026",
        },
      },
      update: {
        submissionStatus: EMPTY_WORKSPACE_2026.submissionStatus,
        reviewStatus: EMPTY_WORKSPACE_2026.reviewStatus,
        message: "",
        submittedAt: null,
        returnedAt: null,
        approvedAt: null,
        lastActivityAt: null,
      },
      create: {
        schoolId: school.id,
        cycleId: "2026",
        submissionStatus: EMPTY_WORKSPACE_2026.submissionStatus,
        reviewStatus: EMPTY_WORKSPACE_2026.reviewStatus,
        message: "",
        submittedAt: null,
        returnedAt: null,
        approvedAt: null,
        lastActivityAt: null,
      },
    });

    workspaceIds2026.push(workspace2026.id);

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

  if (workspaceIds2026.length) {
    await prisma.indicatorResponse.deleteMany({
      where: {
        workspaceId: {
          in: workspaceIds2026,
        },
      },
    });

    await prisma.indicatorReview.deleteMany({
      where: {
        workspaceId: {
          in: workspaceIds2026,
        },
      },
    });
  }
}

async function clearDemoArtifacts() {
  const schoolUser = await prisma.user.findUnique({ where: { email: PRIMARY_SCHOOL_EMAIL } });
  const adminUser = await prisma.user.findUnique({ where: { email: PRIMARY_ADMIN_EMAIL } });
  if (!schoolUser || !adminUser) {
    return;
  }

  await prisma.userSession.deleteMany({
    where: {
      tokenHash: hashSessionToken("demo-session-admin"),
    },
  });

  await prisma.auditEvent.deleteMany({
    where: {
      id: "audit_demo_login_foundation",
    },
  });
}

async function main() {
  await seedReferenceData(prisma);
  await seedUsers();
  await seedWorkspaces();
  await clearDemoArtifacts();
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
