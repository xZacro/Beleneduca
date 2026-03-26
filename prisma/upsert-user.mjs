import "dotenv/config";

import { createPrismaClient } from "../server/prisma-client.mjs";
import { hashPassword } from "../server/fni-passwords.mjs";

const VALID_ROLES = new Set(["FUNDACION", "COLEGIO", "ADMIN"]);
const VALID_STATUSES = new Set(["ACTIVE", "INVITED", "DISABLED"]);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function requiredText(args, key) {
  const value = typeof args[key] === "string" ? args[key].trim() : "";

  if (!value) {
    throw new Error(`Falta el argumento --${key}.`);
  }

  return value;
}

function parseRoles(value) {
  const roles = String(value ?? "")
    .split(",")
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean);

  if (!roles.length) {
    throw new Error("Debes indicar al menos un rol en --roles.");
  }

  for (const role of roles) {
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Rol invalido: ${role}. Usa FUNDACION, COLEGIO o ADMIN.`);
    }
  }

  return [...new Set(roles)];
}

async function ensureSchoolExists(prisma, schoolId) {
  if (!schoolId) return;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });

  if (!school) {
    throw new Error(
      `No existe el colegio ${schoolId}. Cargalo antes en la base o usa uno valido.`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = createPrismaClient();

  try {
    const email = requiredText(args, "email").toLowerCase();
    const name = requiredText(args, "name");
    const roles = parseRoles(requiredText(args, "roles"));
    const schoolId =
      typeof args.schoolId === "string" && args.schoolId.trim() ? args.schoolId.trim() : null;
    const status = (args.status ?? "ACTIVE").trim().toUpperCase();
    const password =
      typeof args.password === "string" && args.password.length > 0 ? args.password : null;

    if (!VALID_STATUSES.has(status)) {
      throw new Error("Status invalido. Usa ACTIVE, INVITED o DISABLED.");
    }

    if (roles.includes("COLEGIO") && !schoolId) {
      throw new Error("Los usuarios con rol COLEGIO requieren --schoolId.");
    }

    await ensureSchoolExists(prisma, schoolId);

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!existingUser && !password) {
      throw new Error(
        "Para crear un usuario nuevo debes indicar --password. En usuarios existentes es opcional."
      );
    }

    const passwordHash = password
      ? hashPassword(password)
      : existingUser?.passwordHash ?? null;

    const user = await prisma.$transaction(async (tx) => {
      const upsertedUser = await tx.user.upsert({
        where: { email },
        update: {
          name,
          schoolId,
          status,
          passwordHash,
        },
        create: {
          email,
          name,
          schoolId,
          status,
          passwordHash,
        },
      });

      await tx.userRole.deleteMany({
        where: {
          userId: upsertedUser.id,
          role: {
            notIn: roles,
          },
        },
      });

      for (const role of roles) {
        await tx.userRole.upsert({
          where: {
            userId_role: {
              userId: upsertedUser.id,
              role,
            },
          },
          update: {},
          create: {
            userId: upsertedUser.id,
            role,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: upsertedUser.id },
        include: {
          roles: true,
        },
      });
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          created: !existingUser,
          email: user.email,
          name: user.name,
          schoolId: user.schoolId ?? null,
          status: user.status,
          roles: user.roles.map((role) => role.role),
          passwordUpdated: Boolean(password),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error creando o actualizando usuario:", error);
  process.exit(1);
});
