# Guia de contribucion

Esta guia resume como trabajar en `fni-portal` sin romper contratos, duplicar logica ni mezclar responsabilidades.

## Antes de cambiar codigo

1. Lee `README.md` para entender scripts, variables y validacion basica.
2. Revisa `docs/guia-arquitectura-buenas-practicas.md` para ubicar la capa correcta.
3. Confirma si el cambio afecta frontend, backend, persistencia o documentacion.
4. Busca si ya existe una funcion, hook o helper que resuelva lo mismo.

## Donde va cada cosa

- UI nueva o ajuste visual: `src/pages/<dominio>/`
- Navegacion, rutas y guards: `src/app/`
- Contratos y DTOs compartidos: `src/shared/**/apiContracts.ts`
- Logica de negocio reutilizable: `src/shared/fni/`
- Cliente HTTP comun: `src/shared/api.ts`
- Servidor HTTP y validaciones: `server/`
- Persistencia y semillas: `prisma/`
- Documentacion transversal: `docs/`

## Reglas de codigo

- Preferir una sola fuente de verdad para cada regla de negocio.
- Si una logica se repite en varias pantallas, extraerla a `src/shared/` o al backend.
- Mantener funciones pequenas y faciles de probar.
- No confiar en la UI para proteger datos sensibles; validar siempre tambien en el backend.
- No acoplar componentes visuales a estructuras internas de almacenamiento.
- Evitar comentarios que repitan el codigo literal; documentar solo decisiones, reglas o contexto no obvio.

## Contratos y cambios de datos

- Si cambia una respuesta de API, actualizar primero el contrato compartido y luego sus consumidores.
- Si cambia un modelo de datos, revisar tambien `docs/database.md`.
- Si afecta despliegue u operacion, revisar `docs/deployment.md`.
- Si hay cambios de seed o de registros demo, validar que los comandos de `db:seed` y `db:validate` sigan funcionando.

## Validacion minima

- Cambios generales: `npm run lint`
- Cambios funcionales: `npm run build`
- Cambios de API: `npm run test:api`
- Cambios de auth, usuarios, ciclos o Prisma: `npm run test:api:prisma`
- Cambios de datos: `npm run db:validate`

## Recomendaciones de revision

- Leer el diff por capas, no solo por archivos.
- Confirmar que no se haya duplicado logica ya existente.
- Revisar que los mensajes, placeholders y estados vacios mantengan el mismo criterio en toda la app.
- Verificar que la documentacion actualizada quede alineada con la implementacion.

## Orden sugerido de lectura

1. `README.md`
2. `docs/guia-arquitectura-buenas-practicas.md`
3. `server/api-server.mjs`
4. `server/fni-domain.mjs`
5. `src/app/router.tsx`
6. `src/shared/fni/logic.ts`
7. `src/shared/auth.ts`

Con esto, una persona nueva puede entrar al proyecto, ubicar cada capa y saber como contribuir sin romper el flujo existente.
