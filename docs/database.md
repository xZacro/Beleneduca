# Base de datos FNI

El proyecto ya puede correr con dos modos de persistencia sin cambiar el frontend:

- `FNI_API_STORAGE=json`: usa `server/.data/db.json`
- `FNI_API_STORAGE=prisma`: usa PostgreSQL mediante Prisma

## Que se agrego

- `prisma/schema.prisma` con el modelo relacional base
- `prisma.config.ts` para Prisma 7 y carga de `DATABASE_URL`
- `prisma/seed.mjs` para poblar una base demo completa
- `prisma/import-json.mjs` para migrar workspaces desde `server/.data/db.json`
- `prisma/upsert-user.mjs` para crear o actualizar usuarios reales en PostgreSQL
- `docker-compose.yml` para levantar PostgreSQL local rapido
- `.env.example` con `DATABASE_URL` y `FNI_API_STORAGE`
- Scripts `db:*` en `package.json`
- Script `ops:backup:prisma` para export operacional del estado actual

## Tablas principales

- `users` y `user_roles`
- `schools`
- `cycles`
- `areas`
- `indicators`
- `fni_workspaces`
- `indicator_responses`
- `indicator_reviews`
- `user_sessions`
- `audit_events`

## Decisiones de modelado

- Los PDFs no van dentro de la base. En `indicator_responses` solo queda metadata y `file_storage_key`.
- El detalle de preguntas por indicador se guarda como `Json` en `questions`, para respetar el esquema dinamico del frontend.
- El estado agregado que necesita la vista de fundacion queda en `fni_workspaces.review_status`.
- El catalogo se genera desde `src/shared/fni/schema/evaluacionSchema.ts`, asi evitamos duplicar el origen de verdad.
- Los documentos subidos siguen en storage local. Si importas desde JSON, migras metadata y referencias; los archivos locales siguen viviendo en `server/.data/documents*`.
- Si el JSON trae PDFs embebidos como `dataUrl`, el importador ahora los materializa al storage local de documentos en vez de guardarlos inline en PostgreSQL.

## Flujo recomendado para PostgreSQL local

1. Copiar `.env.example` a `.env`
2. Cambiar `FNI_API_STORAGE=prisma`
3. Levantar PostgreSQL con `npm run db:start`
4. Crear la base con `npm run db:migrate -- --name init`
5. Cargar datos demo con `npm run db:seed`
6. Iniciar el backend con `npm run api`

## Como cargar data despues

Tienes dos caminos segun el escenario:

- `npm run db:seed`
  - deja una base demo completa: ciclos, colegios, usuarios demo, catalogo, workspaces y datos de ejemplo
- `npm run db:import:json`
  - toma el contenido de `server/.data/db.json`
  - hace `upsert` de colegios, ciclos y catalogo base si faltan
  - sincroniza workspaces, respuestas, revisiones y submission hacia PostgreSQL
  - si encuentra PDFs embebidos como `dataUrl`, los mueve a `server/.data/documents` y guarda `doc:<id>` como referencia en la base
  - por defecto importa desde `server/.data/db.json`
  - tambien puedes pasar otra ruta: `node prisma/import-json.mjs ruta/al/archivo.json`

## Como cargar usuarios reales

Usa `npm run db:user:upsert -- --email ... --name ... --roles ...` para crear o actualizar usuarios en PostgreSQL.

Ejemplos:

- `npm run db:user:upsert -- --email admin@colegio.cl --name "Admin Colegio" --roles ADMIN --password "cambia-esto"`
- `npm run db:user:upsert -- --email encargado@colegio.cl --name "Encargado Colegio" --roles COLEGIO --schoolId sch_1 --password "cambia-esto"`
- `npm run db:user:upsert -- --email fundacion@fni.cl --name "Fundacion FNI" --roles FUNDACION,ADMIN --status ACTIVE --password "cambia-esto"`

Notas:

- Si el usuario es nuevo, `--password` es obligatorio.
- Si el usuario ya existe, puedes omitir `--password` para mantener la actual.
- Si usas rol `COLEGIO`, debes indicar `--schoolId`.

## Comandos

- `npm run db:validate`
- `npm run db:generate`
- `npm run db:start`
- `npm run db:stop`
- `npm run db:migrate -- --name init`
- `npm run db:push`
- `npm run db:seed`
- `npm run db:import:json`
- `npm run db:user:upsert -- --email ... --name ... --roles ...`
- `npm run db:studio`
- `npm run ops:backup:prisma`

## Relacion con el backend actual

- [server/api-server.mjs](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/server/api-server.mjs) soporta ambos modos de persistencia
- [server/fni-storage-prisma.mjs](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/server/fni-storage-prisma.mjs) resuelve los endpoints FNI sobre PostgreSQL
- [src/shared/fni/repository.ts](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/src/shared/fni/repository.ts) mantiene el mismo contrato para el frontend

## Endpoints cubiertos por este modelo

- `GET /api/areas`
- `GET /api/indicators`
- `PUT /api/indicators/:indicatorId`
- `GET /api/fni/workspace?schoolId=...&cycleId=...`
- `PUT /api/fni/workspace/responses`
- `PUT /api/fni/workspace/reviews`
- `PUT /api/fni/workspace/submission`
- `GET /api/foundation/schools?cycleId=...`
- `GET /api/schools`
- `GET /api/cycles`
- `GET /api/management/dashboard?cycleId=...`
- `POST /api/management/cycles`
- `PUT /api/management/cycles/:cycleId`
- `POST /api/management/cycles/:cycleId/reopen`
- `POST /api/management/cycles/:cycleId/close`
