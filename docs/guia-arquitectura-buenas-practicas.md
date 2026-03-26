# Guia de arquitectura y buenas practicas

Esta guia resume como esta organizado `fni-portal`, donde vive cada responsabilidad y que
criterios seguir para mantener el codigo facil de entender y de extender.

## 1. Mapa rapido del proyecto

- `src/main.tsx`: punto de entrada del frontend.
- `src/app/router.tsx`: router principal y carga diferida de paginas.
- `src/app/routeGuards.tsx`: proteccion de rutas segun sesion y roles.
- `src/pages/`: pantallas por dominio funcional.
- `src/shared/`: utilidades compartidas, cliente HTTP, hooks y logica de dominio.
- `server/api-server.mjs`: servidor HTTP principal y enrutador de la API.
- `server/fni-*.mjs`: auth, storage, documentos, auditoria, logging y dominio.
- `prisma/`: schema, seed, importadores y utilidades para PostgreSQL.
- `docs/`: guias operativas y documentacion tecnica.

## 2. Flujo general

El flujo normal de la aplicacion es este:

1. El frontend arranca desde `src/main.tsx`.
2. El router decide que pagina cargar segun la ruta y el rol del usuario.
3. Las paginas consumen la API mediante `src/shared/api.ts` y los contratos de `src/shared/*/apiContracts.ts`.
4. La API valida sesion, permisos y datos en `server/api-server.mjs`.
5. La persistencia se resuelve con un adaptador comun en `server/fni-storage.mjs`.
6. El modo real de almacenamiento puede ser JSON local o Prisma/PostgreSQL sin cambiar el contrato del frontend.

## 3. Capas del frontend

### `src/app`

- Centraliza router, layout y guards.
- `routeConfig.ts` define las rutas y los roles permitidos.
- `home.ts` resuelve la landing page por rol.
- `routeGuards.tsx` evita duplicar reglas de acceso en cada pagina.

### `src/pages`

- Cada subcarpeta representa un dominio funcional.
- `school/`: experiencia del colegio.
- `foundation/`: gestion y revision desde fundacion.
- `admin/`: administracion, sesiones y auditoria.
- `account/`: acciones de la cuenta actual.

### `src/shared`

- `api.ts` es el unico punto de acceso HTTP genrico.
- `auth.ts` maneja sesion, login, logout, heartbeat y password.
- `authZ.ts` centraliza la regla de autorizacion.
- `fni/` contiene logica de negocio reutilizable entre vistas.

## 4. Capas del backend

### `server/api-server.mjs`

- Recibe todas las peticiones HTTP.
- Resuelve CORS, health checks, readiness, auth, workspace, catalogo, documentos y admin.
- Aplica validaciones de entrada y reglas de acceso antes de tocar storage.
- Registra auditoria en operaciones de cambio.

### `server/fni-storage.mjs`

- Selecciona automaticamente el adaptador de persistencia segun `FNI_API_STORAGE`.
- JSON: desarrollo rapido sin base externa.
- Prisma: PostgreSQL para staging o produccion.

### Modulos especializados

- `server/fni-auth*.mjs`: sesiones, login y cambio de contrasena.
- `server/fni-documents.mjs`: subida, descarga y borrado de documentos.
- `server/fni-management*.mjs`: usuarios, ciclos, auditoria y dashboard de gestion.
- `server/fni-domain.mjs`: reglas compartidas del dominio y transformaciones base.
- `server/fni-audit*.mjs`: eventos de auditoria.

## 5. Donde poner cada cosa

- UI de una pantalla nueva: `src/pages/<dominio>/`.
- Rutas y permisos de una pantalla: `src/app/routes/`.
- Cliente HTTP o manejo de errores de red: `src/shared/api.ts`.
- DTOs y contratos de API: `src/shared/**/apiContracts.ts`.
- Logica de calculo o normalizacion usada por varias pantallas: `src/shared/fni/`.
- Validacion, permisos y efectos de servidor: `server/`.
- Persistencia, migraciones y semillas: `prisma/`.
- Documentacion transversal: `docs/`.

## 6. Buenas practicas a seguir

### 6.1 Mantener una sola fuente de verdad

- Si una regla de negocio se reutiliza en varias vistas, centralizala en `src/shared/fni/logic.ts` o en el backend.
- Evita copiar calculos de estado, visibilidad o permisos en las paginas.
- Si cambia el esquema de evaluacion, actualiza el origen de verdad en `src/shared/fni/schema/evaluacionSchema.ts` y deja que el resto derive de ahi.

### 6.2 Validar en el borde

- El frontend puede ayudar con UX, pero el backend debe validar todo de nuevo.
- Las rutas de `server/api-server.mjs` ya separan validacion, permisos y persistencia; manten esa secuencia.
- Cuando agregues un campo nuevo, revisa tambien el contrato de salida para no romper clientes.

### 6.3 Centralizar permisos

- Usa `src/shared/authZ.ts` y los guards del router para la UX.
- Repite la validacion en el backend antes de ejecutar una accion sensible.
- No confies en que ocultar una pantalla impide el acceso a una ruta o endpoint.

### 6.4 Preferir helpers pequenos y puros

- Las funciones puras son mas faciles de probar y documentar.
- `src/shared/fni/logic.ts` y `server/fni-domain.mjs` son buenos lugares para ese tipo de logica.
- Si una funcion empieza a mezclar fetch, estado y formateo, probablemente conviene dividirla.

### 6.5 Conservar contratos estables

- Si cambias una respuesta de API, actualiza primero el contrato compartido y luego las pantallas que la consumen.
- Evita acoplar vistas directamente a estructuras internas del backend.
- Siempre que puedas, transforma datos en la capa shared antes de llegar a componentes visuales.

### 6.6 Documentar cambios de datos

- Si una feature cambia el modelo de datos, documenta el impacto en `docs/database.md`.
- Si afecta operacion o despliegue, actualiza `docs/deployment.md`.
- Si requiere nuevos comandos o seeds, reflejalo en `README.md`.

## 7. Checklist antes de integrar cambios

- Revisar `npm run lint`.
- Revisar `npm run build`.
- Revisar `npm run test:api` y, si toca auth o Prisma, `npm run test:api:prisma`.
- Confirmar que los contratos `frontend <-> API` sigan iguales.
- Revisar que la documentacion afectada quede actualizada.
- Si el cambio toca datos o seed, validar tambien `npm run db:validate` y `npm run db:seed` cuando corresponda.

## 8. Puntos de entrada recomendados para una revision manual

Si quieres entender el proyecto rapido, lee en este orden:

1. `README.md`
2. `server/api-server.mjs`
3. `server/fni-domain.mjs`
4. `server/fni-storage.mjs`
5. `src/app/router.tsx`
6. `src/shared/auth.ts`
7. `src/shared/fni/logic.ts`
8. `docs/database.md`
9. `docs/deployment.md`

## 9. Limpieza del template inicial

Los restos del template inicial de Vite ya fueron retirados.

La app real entra por `src/main.tsx` y el router de `src/app/router.tsx`.
