# Despliegue y Operacion

Esta guia deja un camino claro para staging y produccion sobre la API actual.

## Lo que ya existe

- API local con `health` y `ready`
- Frontend Vite en modo API-only
- Persistencia JSON para desarrollo y Prisma/PostgreSQL para entornos reales
- CI con `lint + build + test:api + test:api:prisma`
- Seed funcional para usuarios, colegios, ciclos y workspaces

## Variables de entorno

Ejemplos incluidos:

- [`.env.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.example)
- [`.env.staging.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.staging.example)
- [`.env.production.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.production.example)

Variables clave:

- `FNI_API_PORT`: puerto del backend
- `FNI_API_STORAGE`: `json` o `prisma`
- `DATABASE_URL`: obligatorio en `prisma`
- `FNI_LOG_LEVEL`: `debug`, `info`, `warn`, `error`
- `FNI_LOG_FORMAT`: `pretty` o `json`
- `FNI_REQUEST_LOG`: `true` para log por request, recomendado en staging
- `FNI_SERVE_STATIC`: sirve `dist/` desde la API cuando vale `true`
- `FNI_STATIC_DIR`: carpeta a servir, por defecto `dist`

## Checklist de staging

1. Copiar [`.env.staging.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.staging.example) a `.env`.
2. Confirmar PostgreSQL accesible y correr `npm run db:push`.
3. Aplicar migraciones con `npm run db:deploy`.
4. Sembrar datos base con `npm run db:seed`.
5. Validar el proyecto con `npm run check:full`.
6. Levantar la API con `npm run api`.
7. Confirmar `GET /api/health` y `GET /api/ready`.
8. Levantar frontend con `npm run dev` o publicar `dist/` despues de `npm run build`.

## Despliegue con un solo proceso

La API ahora puede servir el frontend compilado cuando:

- `FNI_SERVE_STATIC=true`
- `FNI_STATIC_DIR=dist`

Con eso:

- `/api/*` sigue yendo al backend
- rutas SPA como `/login` o `/foundation/dashboard` responden `index.html`
- assets en `dist/assets/*` salen directo desde el mismo proceso Node

## Stack de produccion recomendado

Hay un stack listo en [docker-compose.prod.yml](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/docker-compose.prod.yml).

Incluye:

- `app` con la imagen del proyecto
- `postgres` interno y persistente
- volumen separado para documentos

Variables que debes definir al desplegar:

- `POSTGRES_PASSWORD`: contrasena del superusuario de PostgreSQL
- `APP_PORT`: opcional, puerto publico del host, por defecto `80`

Flujo recomendado:

1. Copia el repo o la imagen al VPS.
2. Configura `POSTGRES_PASSWORD`.
3. Ejecuta `docker compose -f docker-compose.prod.yml up -d --build`.
4. Corre `docker compose -f docker-compose.prod.yml --profile tools run --rm seed` una sola vez.
5. Verifica `GET /api/ready`.

Si ya cambiaste codigo:

1. actualiza el repo
2. corre `docker compose -f docker-compose.prod.yml up -d --build`
3. si hubo cambios de esquema, ejecuta `docker compose -f docker-compose.prod.yml --profile tools run --rm seed` o usa `npm run db:push` / `npm run db:migrate` dentro de un contenedor de herramientas

Si solo cambiaste configuracion:

1. cambia las variables de entorno
2. reinicia el stack con `docker compose -f docker-compose.prod.yml up -d`

Si solo cambiaste datos:

1. corre un backup con `npm run ops:backup:prisma`
2. modifica PostgreSQL o el storage de documentos
3. revalida con `GET /api/ready`

## Contenedor base

Hay un contenedor listo en [Dockerfile](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/Dockerfile).

Flujo:

1. instala dependencias
2. compila frontend
3. copia `dist`, `server`, `prisma` y el schema compartido
4. levanta `server/api-server.mjs`

Uso de referencia:

1. construir imagen: `docker build -t fni-portal .`
2. correrla con variables reales de entorno
3. exponer `4100`

## Checklist de produccion

1. Partir desde [`.env.production.example`](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/.env.production.example).
2. Usar `FNI_API_STORAGE=prisma`.
3. Configurar una `DATABASE_URL` real y protegida.
4. Mantener `FNI_LOG_FORMAT=json`.
5. Ejecutar `npm run check:full` antes de desplegar.
6. Confirmar que `GET /api/ready` responda `200`.
7. Definir respaldos periodicos de PostgreSQL mas el storage local de documentos.
8. Si usas un solo proceso para frontend + backend, activar `FNI_SERVE_STATIC=true`.
9. Si usas Docker Compose, preferir [docker-compose.prod.yml](C:/Users/tokyotech/Desktop/Lunaria%20IA/BELEN%20EDUCA/fni-portal/docker-compose.prod.yml).

## Respaldos operativos

Hay dos comandos de exportacion:

- `npm run ops:backup:json`
- `npm run ops:backup:prisma`

Tambien puedes usar `npm run ops:backup` y toma el modo desde `FNI_API_STORAGE`.

Salida:

- genera una carpeta bajo `backups/<timestamp>-<mode>/`
- escribe `manifest.json`
- en modo `json` copia `server/.data`
- en modo `prisma` exporta tablas clave a `database.json` y copia `documents/` si existe

Importante:

- el backup `prisma` es un respaldo logico de la aplicacion, no reemplaza un `pg_dump` o backup administrado del motor
- los PDFs siguen viviendo en storage local, asi que deben respaldarse junto con la base

## Monitoreo minimo recomendado

- `GET /api/health`: confirma que el proceso HTTP esta arriba
- `GET /api/ready`: confirma storage y documents accesibles

## Logging

La API ahora soporta:

- `FNI_LOG_LEVEL`
- `FNI_LOG_FORMAT`
- `FNI_REQUEST_LOG`

Recomendacion:

- desarrollo local: `pretty` + `FNI_REQUEST_LOG=false`
- staging: `json` + `FNI_REQUEST_LOG=true`
- produccion: `json` + `FNI_REQUEST_LOG=false` o `true` segun volumen y observabilidad
