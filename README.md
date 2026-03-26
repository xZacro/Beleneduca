# FNI Portal

Frontend React/Vite del portal FNI, trabajando en modo API-only contra una API local de desarrollo.

## Scripts

- `npm run dev`: levanta el frontend Vite en desarrollo.
- `npm run api`: levanta la API local en `http://localhost:4100` por defecto.
- `npm run lint`: ejecuta ESLint.
- `npm run build`: valida TypeScript y genera build de produccion.
- `npm run check`: corre `lint + build + test:api`.
- `npm run check:full`: corre `check + test:api:prisma`.
- `npm run test:api`: corre pruebas HTTP del backend en modo JSON aislado.
- `npm run test:api:prisma`: corre smoke tests HTTP del backend en modo Prisma.
- `npm run test:api:all`: ejecuta ambas suites seguidas.
- `npm run ops:backup`: genera un respaldo segun `FNI_API_STORAGE`.
- `npm run ops:backup:json`: respalda `server/.data`.
- `npm run ops:backup:prisma`: exporta tablas Prisma y documentos locales.

## Flujo local recomendado

1. En una terminal, ejecutar `npm run api`.
2. En otra terminal, ejecutar `npm run dev`.
3. Crear un `.env.local` con:

```bash
VITE_API_BASE=/api
# Opcional:
# VITE_API_PROXY_TARGET=http://localhost:4100
```

La API local usa `FNI_API_PORT=4100` por defecto. Para probar contra PostgreSQL + Prisma, cambia `FNI_API_STORAGE=prisma`, asegurate de tener `DATABASE_URL` configurado y ejecuta `npm run db:seed`.

El proxy de Vite usa `FNI_API_PORT` por defecto y tambien acepta `VITE_API_PROXY_TARGET` si necesitas apuntar el frontend a otro host o puerto.

Variables operativas disponibles en `.env`:

- `FNI_LOG_LEVEL`
- `FNI_LOG_FORMAT`
- `FNI_REQUEST_LOG`
- `FNI_SERVE_STATIC`
- `FNI_STATIC_DIR`

Ejemplos por ambiente:

- [`.env.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.example)
- [`.env.staging.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.staging.example)
- [`.env.production.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.production.example)

## Validacion recomendada antes de subir cambios

- Cambios normales de frontend/backend: `npm run check`
- Cambios de auth, permisos, usuarios, ciclos o Prisma: `npm run check:full`

Ademas, GitHub Actions ejecuta automaticamente:

- `lint + build + test:api` en cada push y pull request
- `db:push + db:seed + test:api:prisma` en un job separado con PostgreSQL

## Credenciales de desarrollo para auth API

- `admin@demo.cl` / `demo`
- `fundacion.01@demo.cl` a `fundacion.06@demo.cl` / `demo`
- `cace@demo.cl`, `camv@demo.cl`, `ccoc@demo.cl`, `cjff@demo.cl` / `demo`
- `cjlu@demo.cl`, `cjmc@demo.cl`, `clsm@demo.cl`, `cpdm@demo.cl` / `demo`
- `crsh@demo.cl`, `csah@demo.cl`, `csdm@demo.cl`, `csfa@demo.cl` / `demo`

Esas mismas credenciales quedan sembradas en Prisma cuando corres `npm run db:seed`.

## Endpoints locales disponibles

- `GET /api/health`
- `GET /api/ready`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/heartbeat`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/me`
- `GET /api/schools`
- `GET /api/cycles`
- `GET /api/management/dashboard?cycleId=`
- `POST /api/management/cycles`
- `PUT /api/management/cycles/:cycleId`
- `POST /api/management/cycles/:cycleId/reopen`
- `POST /api/management/cycles/:cycleId/close`
- `GET /api/areas`
- `GET /api/indicators`
- `GET /api/indicators/:indicatorId`
- `PUT /api/indicators/:indicatorId`
- `POST /api/catalog/seed`
- `GET /api/fni/workspace?schoolId=&cycleId=`
- `PUT /api/fni/workspace/responses?schoolId=&cycleId=`
- `PUT /api/fni/workspace/reviews?schoolId=&cycleId=`
- `PUT /api/fni/workspace/submission?schoolId=&cycleId=`
- `POST /api/fni/documents/upload?schoolId=&cycleId=&indicatorId=`
- `GET /api/fni/documents/:documentId/download`
- `DELETE /api/fni/documents/:documentId`
- `GET /api/foundation/schools?cycleId=`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:userId`
- `POST /api/admin/users/:userId/reset-password`
- `GET /api/admin/sessions`
- `GET /api/admin/audit`

## Persistencia local

- Datos de workspace: `server/.data/db.json`
- Sesiones auth: `server/.data/sessions.json`
- Archivos PDF: `server/.data/documents/`
- Metadata de documentos: `server/.data/documents.json`

## Operacion y despliegue

- Guia de base de datos: [docs/database.md](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/docs/database.md)
- Guia de despliegue y respaldos: [docs/deployment.md](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/docs/deployment.md)
- Guia de arquitectura y buenas practicas: [docs/guia-arquitectura-buenas-practicas.md](docs/guia-arquitectura-buenas-practicas.md)
- Guia de contribucion: [docs/guia-contribucion.md](docs/guia-contribucion.md)
- Imagen lista para staging: [Dockerfile](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/Dockerfile)

## Contratos frontend

Los DTOs compartidos que usa el frontend para consumir la API viven en:

- `src/shared/fni/apiContracts.ts`
- `src/shared/fni/repository.ts`
- `src/shared/management/apiContracts.ts`
- `src/shared/admin/apiContracts.ts`
