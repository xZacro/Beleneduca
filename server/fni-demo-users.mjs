import { DEMO_SCHOOLS } from "./fni-domain.mjs";

export const PRIMARY_ADMIN_EMAIL = "admin@demo.cl";
export const PRIMARY_FOUNDATION_EMAIL = "fundacion.01@demo.cl";
export const PRIMARY_SCHOOL_EMAIL = "cace@demo.cl";

const FOUNDATION_USERS = Array.from({ length: 6 }, (_, index) => ({
  email: `fundacion.${String(index + 1).padStart(2, "0")}@demo.cl`,
  name: `Fundacion Equipo ${index + 1}`,
  roles: ["FUNDACION"],
  schoolId: null,
  password: "demo",
}));

const SCHOOL_USERS = DEMO_SCHOOLS.map((school) => ({
  email: `${school.code.toLowerCase()}@demo.cl`,
  name: school.name,
  roles: ["COLEGIO"],
  schoolId: school.id,
  password: "demo",
}));

export const DEMO_AUTH_USERS = [
  {
    email: PRIMARY_ADMIN_EMAIL,
    name: "Admin Principal",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
  ...FOUNDATION_USERS,
  ...SCHOOL_USERS,
];

export const DEMO_AUTH_USERS_BY_EMAIL = Object.fromEntries(
  DEMO_AUTH_USERS.map((user) => [user.email, user])
);
