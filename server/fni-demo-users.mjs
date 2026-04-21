import { DEMO_SCHOOLS } from "./fni-domain.mjs";

export const PRIMARY_ADMIN_EMAIL = "ebravo@outlook.cl";
export const PRIMARY_FOUNDATION_EMAIL = "pedro.letelier@beleneduca.cl";
export const PRIMARY_SCHOOL_EMAIL = "ppontillo@beleneduca.cl";

const ADMIN_USERS = [
  {
    email: "pablo.munoz@beleneduca.cl",
    name: "Pablo Ignacio Muñoz Osorio",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "felipe.munoz@beleneduca.cl",
    name: "Felipe Muñoz",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "mariajose.rojas@beleneduca.cl",
    name: "María José Rojas",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "arantza.farias@beleneduca.cl",
    name: "Arantza Del Rosario",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
  {
    email: PRIMARY_ADMIN_EMAIL,
    name: "Emanuel Bravo",
    roles: ["ADMIN"],
    schoolId: null,
    password: "demo",
  },
];

const FOUNDATION_USERS = [
  {
    email: "pedro.letelier@beleneduca.cl",
    name: "Pedro Letelier",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "gabriel.olate@beleneduca.cl",
    name: "Gabriel Olate",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "pedro.larrain@beleneduca.cl",
    name: "Pedro Larraín",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "jose.bustamante@beleneduca.cl",
    name: "Jose Bustamante",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "matias.bascur@beleneduca.cl",
    name: "Matias Bascur",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "monica.luna@beleneduca.cl",
    name: "Monica Luna",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
  {
    email: "pilar.reyes@beleneduca.cl",
    name: "Pilar Reyes",
    roles: ["FUNDACION"],
    schoolId: null,
    password: "demo",
  },
];

const SCHOOL_USERS = DEMO_SCHOOLS.map((school) => ({
  email: school.managerEmail ?? `${school.code.toLowerCase()}@beleneduca.cl`,
  name: school.managerName ?? school.name,
  roles: ["COLEGIO"],
  schoolId: school.id,
  password: "demo",
}));

export const DEMO_AUTH_USERS = [...ADMIN_USERS, ...FOUNDATION_USERS, ...SCHOOL_USERS];

export const DEMO_AUTH_USERS_BY_EMAIL = Object.fromEntries(
  DEMO_AUTH_USERS.map((user) => [user.email, user])
);
