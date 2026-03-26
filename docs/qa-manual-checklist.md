# Checklist de QA manual

Esta lista sirve para validar el proyecto en navegador antes de subir cambios.  
Está pensada para usarla con el frontend en `npm run dev` y la API en `npm run api`.

## 1. Preparacion

- [ ] Levantar la API local con `npm run api`.
- [ ] Levantar el frontend con `npm run dev`.
- [ ] Confirmar que `VITE_API_BASE=/api` este configurado en `.env.local`.
- [ ] Si se quiere probar Prisma, verificar `FNI_API_STORAGE=prisma` y tener la base preparada con `npm run db:seed`.

## 2. Login y acceso

- [ ] Abrir `/login` y confirmar que la pantalla carga sin errores.
- [ ] Iniciar sesion con `admin@demo.cl`.
- [ ] Iniciar sesion con `fundacion.01@demo.cl`.
- [ ] Iniciar sesion con `cace@demo.cl`.
- [ ] Validar que cada rol cae en su home correcto al entrar.
- [ ] Cerrar sesion y confirmar que vuelve a login.
- [ ] Intentar entrar a una ruta protegida sin sesion y confirmar redireccion a login.

## 3. Flujos comunes

- [ ] Abrir `Mi cuenta` o `Seguridad` desde el menu y confirmar acceso segun rol.
- [ ] Cambiar contrasena propia y verificar que el sistema acepta la accion.
- [ ] Intentar cambiar contrasena con datos invalidos y confirmar validacion visible.
- [ ] Refrescar la pagina en una ruta interna y confirmar que no se rompe el estado.
- [ ] Revisar que el menu lateral o superior muestre solo opciones del rol activo.

## 4. Colegio

- [ ] Entrar con un usuario de colegio.
- [ ] Verificar que el dashboard muestra el estado del ciclo actual.
- [ ] Abrir la pagina de evaluacion.
- [ ] Responder preguntas visibles y guardar cambios.
- [ ] Confirmar que preguntas ocultas no afectan el guardado.
- [ ] Adjuntar un documento PDF desde documentos.
- [ ] Descargar el documento adjunto.
- [ ] Eliminar el documento y confirmar que desaparece del workspace.
- [ ] Intentar entrar a pantallas de admin o fundacion y confirmar acceso denegado.

## 5. Fundacion

- [ ] Entrar con un usuario de fundacion.
- [ ] Abrir el dashboard y revisar indicadores generales.
- [ ] Abrir la lista de colegios.
- [ ] Cambiar entre vista de cards y tabla.
- [ ] Filtrar por busqueda, estado, porcentaje y bloqueados.
- [ ] Cambiar de ciclo y confirmar que la URL refleja el `cycleId`.
- [ ] Abrir un colegio en formulario.
- [ ] Revisar documentos del colegio.
- [ ] Abrir la revision del colegio y confirmar estado, observaciones y envio.
- [ ] Entrar al catalogo y revisar el detalle de un indicador.
- [ ] Intentar entrar a rutas de admin y confirmar acceso denegado.

## 6. Admin

- [ ] Entrar con `admin@demo.cl`.
- [ ] Abrir el dashboard administrativo.
- [ ] Revisar la lista de usuarios.
- [ ] Crear o editar un usuario de prueba.
- [ ] Resetear la contrasena de un usuario.
- [ ] Abrir sesiones activas y confirmar que se listan correctamente.
- [ ] Abrir auditoria y confirmar que hay eventos.
- [ ] Abrir gestion de ciclos y probar abrir, cerrar y reabrir segun permisos.
- [ ] Intentar entrar a rutas de colegio o fundacion sin el contexto esperado y confirmar que el acceso sigue acotado por rol.

## 7. Validaciones tecnicas

- [ ] Probar que un 404 o ruta desconocida redirige a la aplicacion.
- [ ] Verificar que el cargado diferido de pantallas muestra un estado de carga legible.
- [ ] Confirmar que los mensajes de error de API se muestran en pantalla.
- [ ] Revisar que los formularios no se rompan con entradas vacias o incompletas.
- [ ] Validar que los estados vacios se vean claros y comprensibles.
- [ ] Probar la app en ancho de escritorio y en una vista angosta para revisar responsividad basica.

## 8. Criterio de salida

- [ ] Ningun flujo critico queda bloqueado.
- [ ] Ninguna ruta protegida permite acceso indebido.
- [ ] CRUD y descargas principales responden correctamente.
- [ ] No aparecen errores visibles en consola del navegador al completar los flujos principales.

## 9. Registro de hallazgos

Usa este formato para documentar cada problema:

- Fecha:
- Rol:
- Ruta:
- Resultado esperado:
- Resultado real:
- Severidad:
- Evidencia:

## 10. Orden recomendado

1. Login y acceso.
2. Flujos comunes.
3. Colegio.
4. Fundacion.
5. Admin.
6. Validaciones tecnicas.

Con esta lista puedes hacer una pasada rapida de QA manual y detectar fallos funcionales, de permisos o de UX antes de abrir un PR.
