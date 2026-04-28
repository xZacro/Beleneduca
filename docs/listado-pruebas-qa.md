# Listado de pruebas QA

Este documento organiza las pruebas que ejecutaremos sobre el portal para validar un cambio antes de entregarlo o publicarlo.

## 1. Preparacion

- [ ] Levantar la API local con `npm run api`.
- [ ] Levantar el frontend con `npm run dev`.
- [ ] Confirmar que el frontend apunte a la API correcta.
- [ ] Verificar que existan usuarios de prueba para admin, fundacion y colegio.
- [ ] Si se probara Prisma, asegurar que la base este preparada y sembrada.

## 2. Pruebas automatizadas

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:api`
- [ ] `npm run test:api:prisma`
- [ ] `npm run check`
- [ ] `npm run check:full`

## 3. Acceso y autenticacion

- [ ] Abrir la pantalla de login.
- [ ] Iniciar sesion como administrador.
- [ ] Iniciar sesion como fundacion.
- [ ] Iniciar sesion como colegio.
- [ ] Confirmar que cada rol entra a su panel correcto.
- [ ] Cerrar sesion y confirmar retorno al login.
- [ ] Intentar abrir una ruta protegida sin sesion.
- [ ] Confirmar que la app redirige o bloquea el acceso.
- [ ] Probar cambio de contrasena del usuario autenticado.

## 4. Flujo de colegio

- [ ] Abrir el dashboard de colegio.
- [ ] Revisar que el ciclo y el estado de trabajo se muestren correctamente.
- [ ] Abrir la pantalla de evaluacion.
- [ ] Responder campos visibles y guardar.
- [ ] Confirmar que las respuestas se conservan al recargar.
- [ ] Adjuntar un documento PDF valido.
- [ ] Descargar el documento subido.
- [ ] Eliminar el documento y verificar que desaparece.
- [ ] Probar que un archivo que no sea PDF es rechazado.
- [ ] Intentar acceder a pantallas de fundacion o admin.

## 5. Flujo de fundacion

- [ ] Abrir el dashboard de fundacion.
- [ ] Revisar indicadores y resumen general.
- [ ] Abrir la lista de colegios.
- [ ] Cambiar entre vistas disponibles si existen.
- [ ] Filtrar o buscar colegios.
- [ ] Abrir un colegio especifico.
- [ ] Revisar la informacion del formulario.
- [ ] Revisar documentos asociados.
- [ ] Abrir la revision de un colegio.
- [ ] Registrar una observacion o cambio permitido.
- [ ] Confirmar que el guardado persiste.
- [ ] Abrir el catalogo compartido.
- [ ] Ver el detalle de un indicador.
- [ ] Intentar entrar a rutas de admin.

## 6. Flujo de administrador

- [ ] Abrir el dashboard administrativo.
- [ ] Revisar la lista de usuarios.
- [ ] Crear o editar un usuario de prueba.
- [ ] Resetear contrasena de un usuario.
- [ ] Revisar sesiones activas.
- [ ] Abrir auditoria.
- [ ] Revisar gestion de ciclos.
- [ ] Probar abrir, cerrar y reabrir ciclos segun permisos.
- [ ] Intentar acceder a pantallas fuera del rol esperado.

## 7. Validaciones tecnicas

- [ ] Probar una ruta desconocida.
- [ ] Confirmar que los estados vacios se entiendan bien.
- [ ] Confirmar que los errores de API se muestren con claridad.
- [ ] Probar formularios con datos incompletos.
- [ ] Revisar que la app funcione en escritorio y en ancho angosto.
- [ ] Verificar que no aparezcan errores visibles en consola al completar el flujo principal.

## 8. Nuevo flujo

- [ ] Abrir la pantalla o modulo nuevo cuando este disponible.
- [ ] Identificar el rol que puede usarlo.
- [ ] Verificar acceso permitido y denegado.
- [ ] Probar crear, guardar, editar y eliminar si el flujo lo requiere.
- [ ] Confirmar que la informacion persiste al recargar.
- [ ] Validar mensajes de error, validaciones y estados vacios.
- [ ] Probar la interaccion con documentos, si corresponde.

## 9. Orden recomendado

1. Preparacion.
2. Pruebas automatizadas.
3. Acceso y autenticacion.
4. Flujo de colegio.
5. Flujo de fundacion.
6. Flujo de administrador.
7. Validaciones tecnicas.
8. Nuevo flujo.

## 10. Criterio de salida

- [ ] Ningun flujo critico queda bloqueado.
- [ ] No hay acceso indebido entre roles.
- [ ] Las operaciones principales responden correctamente.
- [ ] Los errores visibles quedaron resueltos o documentados.
- [ ] La app se puede entregar sin romper lo ya existente.

## 11. Registro de hallazgos

Usa este formato para registrar cada problema:

- Fecha:
- Rol:
- Ruta:
- Resultado esperado:
- Resultado real:
- Severidad:
- Evidencia:

