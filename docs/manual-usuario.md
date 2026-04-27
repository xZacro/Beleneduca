# Manual de usuario

Este archivo queda como manual general e historico. Para versiones mas detalladas y dirigidas por perfil, use:

- [Manual de Administrador](docs/manual-administrador.pdf)
- [Manual de Fundacion](docs/manual-fundacion.pdf)
- [Manual de Colegio](docs/manual-colegio.pdf)

Las capturas fuente viven en `docs/assets/manual-usuario/` y se usan para generar los tres PDFs anteriores.

## 1. Que hace la aplicacion

La plataforma FNI centraliza el seguimiento de ciclos, evidencias, observaciones y revisiones para tres perfiles principales:

- Colegio: completa la evaluacion y adjunta documentos.
- Fundacion: revisa colegios, observa hallazgos y da seguimiento al ciclo.
- Administracion: gestiona usuarios, sesiones, auditoria y ciclos.

## 2. Antes de comenzar

- Usa un navegador moderno.
- Ten a mano tu correo institucional y tu contrasena.
- Si estas en ambiente de prueba, usa las credenciales demo definidas por el equipo.
- Si el navegador te deja fuera por inactividad, vuelve a iniciar sesion.

## 3. Como iniciar sesion

1. Abre la pantalla de ingreso.
2. Escribe tu correo y tu contrasena.
3. Presiona `Ingresar`.
4. La plataforma te llevara automaticamente al panel que corresponde a tu perfil.

Si no recuerdas tu acceso:

1. Abre la opcion de recuperacion de contrasena desde la pantalla de login.
2. Escribe tu correo.
3. Agrega un mensaje corto explicando el problema.
4. Envialo para que administracion lo revise.

## 4. Navegacion general

- En la parte superior veras el nombre de la institucion y tu rol activo.
- En el menu lateral solo aparecen las secciones permitidas para tu perfil.
- El boton `Salir` cierra tu sesion.
- La opcion `Seguridad` permite revisar o cambiar tu contrasena.
- Si intentas abrir una pantalla sin permiso, la app te redirige o muestra acceso denegado.

## 5. Manual para colegio

### 5.1 Dashboard

El dashboard del colegio muestra:

- avance general del ciclo,
- areas con observaciones,
- documentos pendientes,
- acciones recomendadas,
- ultimos comentarios o revisiones.

### 5.2 Evaluacion FNI

1. Entra a `Evaluacion FNI`.
2. Revisa las preguntas visibles para cada indicador.
3. Completa solo lo que corresponda.
4. Guarda los cambios con frecuencia.
5. Revisa si hay observaciones o bloqueos antes de enviar.

Consejos:

- Si una pregunta no aparece, probablemente depende de una respuesta anterior.
- No fuerces respuestas en campos que no correspondan.
- El avance se calcula sobre los indicadores visibles del ciclo.

### 5.3 Documentos

1. Entra a `Documentos`.
2. Sube archivos PDF cuando el sistema lo solicite.
3. Verifica que el documento aparezca en la lista.
4. Descarga el archivo para confirmar que quedo correcto.
5. Si necesitas corregirlo, elimina el documento y vuelve a subirlo.

### 5.4 Cierre de trabajo

1. Confirma que la evaluacion quedo guardada.
2. Revisa que no queden observaciones sin atender.
3. Si todo esta listo, deja el ciclo preparado para revision de fundacion.

## 6. Manual para fundacion

### 6.1 Dashboard

La vista de fundacion resume:

- estado del ciclo,
- colegios activos,
- colegios con observaciones,
- documentos faltantes,
- areas con mayor riesgo.

### 6.2 Lista de colegios

1. Entra a `Colegios`.
2. Usa el buscador para encontrar un establecimiento por codigo, nombre o encargado.
3. Filtra por estado, nivel de completitud o bloqueos.
4. Cambia entre vista de tarjetas y tabla segun te resulte mas comodo.
5. Revisa el ciclo activo antes de analizar un colegio.

### 6.3 Formulario del colegio

1. Abre un colegio desde la lista.
2. Revisa sus datos generales.
3. Confirma responsables, estado y ciclo.
4. Usa esta vista para corregir o completar informacion administrativa.

### 6.4 Documentos del colegio

1. Abre la seccion de documentos del colegio.
2. Revisa los archivos cargados.
3. Descarga los documentos para validacion.
4. Elimina o reemplaza documentos cuando corresponda.

### 6.5 Revision del colegio

1. Abre la pantalla de revision.
2. Verifica el avance por area e indicador.
3. Marca observaciones cuando algo no cumpla.
4. Si el indicador no cumple, deja una explicacion clara para el colegio.
5. Cuando corresponda, bloquea o aprueba segun el estado del ciclo.

### 6.6 Catalogo FNI

1. Entra a `Catalogo FNI`.
2. Revisa las areas e indicadores del sistema.
3. Abre el detalle de un indicador para ver su definicion.
4. Usa el catalogo como referencia para revisar criterios de evaluacion.

## 7. Manual para administracion

### 7.1 Panel administrativo

La vista administrativa muestra una lectura global del sistema:

- colegios,
- usuarios,
- actividad reciente,
- sesiones activas,
- documentos del ciclo,
- estado general de la operacion.

### 7.2 Usuarios

1. Abre `Usuarios`.
2. Busca una persona por nombre o correo.
3. Crea un usuario nuevo si hace falta.
4. Edita datos o roles cuando el perfil cambie.
5. Restablece contrasenas cuando sea necesario.

### 7.3 Accesos

1. Abre `Accesos`.
2. Revisa quien esta conectado.
3. Detecta sesiones inusuales o antiguas.
4. Usa esta pantalla para control operativo o soporte.

### 7.4 Actividad

1. Abre `Actividad`.
2. Revisa los eventos registrados por el sistema.
3. Busca acciones relevantes por tipo o fecha.
4. Usa la auditoria como respaldo cuando necesites confirmar un cambio.

### 7.5 Ciclos

1. Revisa el ciclo activo en el dashboard.
2. Crea un ciclo nuevo si el proceso lo requiere.
3. Cierra el ciclo cuando ya no deban seguir cambios.
4. Reabre un ciclo solo si existe una necesidad operativa valida.

## 8. Seguridad y buenas practicas de uso

- No compartas credenciales.
- Cierra sesion al terminar.
- No cargues archivos que no correspondan al ciclo.
- Revisa dos veces antes de aprobar o cerrar un ciclo.
- Si un dato parece incorrecto, valida primero el contexto antes de editar.

## 9. Problemas comunes

### No puedo entrar

- Verifica que el correo y la contrasena sean correctos.
- Confirma que tu cuenta tenga el rol correcto.
- Usa la recuperacion de contrasena si no recuerdas tus datos.

### No veo una pantalla

- Probablemente tu rol no tiene permiso para esa seccion.
- Revisa que estes usando el perfil correcto.

### Un documento no sube

- Confirma que sea PDF.
- Revisa que el archivo no este dañado.
- Intenta de nuevo despues de recargar la pagina.

### La pagina se quedo atrasada

- Recarga la vista.
- Si estas inactivo mucho tiempo, vuelve a iniciar sesion.

## 10. Flujo rapido por perfil

### Colegio

1. Entra al dashboard.
2. Completa la evaluacion.
3. Sube los documentos.
4. Corrige observaciones.
5. Revisa que el envio quede listo.

### Fundacion

1. Entra al dashboard.
2. Revisa la lista de colegios.
3. Filtra por riesgo o estado.
4. Abre documentos y revision.
5. Da seguimiento hasta dejar el ciclo consistente.

### Administracion

1. Entra al panel administrativo.
2. Revisa usuarios y accesos.
3. Monitorea actividad.
4. Gestiona ciclos.
5. Mantiene el orden general del sistema.

Este manual esta pensado para acompañar el uso diario de la plataforma y servir como referencia rapida para usuarios nuevos y para soporte operativo.
