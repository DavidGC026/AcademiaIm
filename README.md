# Campus IMCYC

Academia IMCYC y RUA Diplo comparten esta fuente. Un único historial permite llevar
las mejoras a ambos campus sin volver a mantener versiones divergentes. Cada
instalación conserva su identidad, programa, base de datos, archivos y conexión de IA.

| Instalación | Base path | Proceso PM2 | Puerto |
| --- | --- | --- | --- |
| Academia IMCYC | `/Academia` | `academia-lms` | 3005 |
| RUA Diplo | `/ruadiplo` | `ruadiplo-lms` | 3006 |

La identidad se resuelve en `src/lib/campusBranding.ts` y `campusLanding.ts` a partir
de `NEXT_PUBLIC_BASE_PATH`, tanto al compilar como al ejecutar. Publicar cambios en
una instancia no actualiza la otra: se despliega el mismo commit dos veces siguiendo
[DESPLIEGUE.md](DESPLIEGUE.md). Nunca se copian bases, `.env.local` ni archivos de un
campus encima del otro.

## Desarrollo y comprobaciones

Requiere Node.js 20.19 o posterior, pnpm y MySQL/MariaDB. Instalar con
`pnpm install --frozen-lockfile`; configurar localmente `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` y `NEXT_PUBLIC_BASE_PATH`.
`JWT_SECRET` debe ser privado y distinto por campus. Las cookies y audiencias JWT
también son independientes: cerrar sesión en un campus conserva la del otro.

```bash
ACADEMIA_SKIP_DB_INIT=1 DB_AUTO_INIT=0 pnpm dev
pnpm exec tsc --noEmit
pnpm test:core
pnpm test:media
pnpm test:exams
ACADEMIA_SKIP_DB_INIT=1 DB_AUTO_INIT=0 pnpm build
```

Las pruebas de integración requieren una copia aislada con `DB_NAME` terminado en
`_qa`, servidor local y destinatarios ficticios. No se ejecutan sobre producción.
`pnpm test:exam-api` comprueba el ciclo completo de evaluaciones con `EXAM_QA_URL`;
`ASSISTANT_CONTEXT_QA=1 pnpm test:assistant` comprueba que el contexto académico respete acceso y estados.
`ASSISTANT_CONFIG_QA_URL=<URL-local> pnpm test:assistant-config` verifica permisos y
cambios de proveedor sin llamadas externas. `CAMPUS_QA_DIR=<directorio-privado> pnpm test:sessions`
comprueba login, perfil y cierre en las dos instancias locales.
`pnpm exec tsx --test tests/exam-autosubmit.browser.ts` requiere además
`agent-browser` y prueba el vencimiento real del temporizador.

`pnpm migrate:campus` realiza sólo cambios aditivos de esquema sobre la base indicada
explícitamente por `DB_NAME`. El despliegue la ejecuta con respaldo antes de activar
el proceso. Las semillas y migraciones heredadas de `initDb` sólo se permiten con
`DB_AUTO_INIT=1` en desarrollo; no forman parte del arranque de producción.

## Funciones compartidas

- Portada, menús adaptables, tutorial por rol y editor de clases en tres pasos.
- Videos por sección de hasta 250 MB; documentos de hasta 25 MB; portadas PDF,
  lectura ampliada y búsqueda de bibliografías.
- Exámenes editables, importación clásica y formato M1 de dos hojas, liberación
  manual o por tarea, resultados e historial de reintentos. Un banco permite elegir
  cuántas preguntas se muestran; el subconjunto y su clave quedan congelados durante
  cada intento. El temporizador usa el reloj del servidor y entrega el borrador
  cuando vence; un intento vencido sin entrega no inventa una calificación.
- Asistente del alumno con contexto de sus materias y clase, pendientes, calendario,
  formato legible y enlaces autorizados. Las consultas de navegación se resuelven
  localmente; las explicaciones generadas requieren la clave propia de cada campus.
  Sin calificaciones, el panel muestra «Sin calificaciones».

La configuración de IA es exclusiva de administración. Para OpenAI puede usarse
`OPENAI_API_KEY` en el entorno privado del servidor (tiene prioridad) o la clave
guardada desde el panel. No guardar claves en Git. Sin conexión configurada, el
asistente conserva orientación sobre la plataforma y avisa al pedir explicaciones.

## Entrevistas técnicas

El catálogo inicial usa las siete entrevistas reales de
[Líderes de la construcción de Webinars](https://webinars.webinarsenconcreto.com/lideres-de-la-construccion.php),
verificadas el 2026-10-19 en el canal IMCYC. `src/data/webinars-interviews.json`
conserva nombres, videos, descripciones y duraciones comprobadas; no atribuye
cargos que la fuente no proporciona. Los campos opcionales vacíos no se muestran.

Con el entorno del campus cargado y respaldo previo de `biblioteca_entrevistas`,
`pnpm sync:interviews` retira los marcadores antiguos e incorpora los videos que
faltan. Es una operación explícita de contenido, separada del despliegue y de las
migraciones de esquema. Conserva otras entrevistas y ediciones de administración;
repetirla no duplica los videos. `INTERVIEWS_QA=1 pnpm test:interviews` verifica
este comportamiento en una tabla temporal de una base local terminada en `_qa`.

## Paneles y contraseñas

El maestro administra sus materias desde **Mis materias** (`/maestro/materias`)
y el administrador desde **Materias y contenido** (`/admin/materias`). El botón
**Nueva materia** abre el alta con nombre, descripción e imagen. Las materias de
maestros requieren aprobación; las creadas por administradores se aprueban al guardar.
**Descripción y datos** permite editar una materia incluso durante su revisión.

Cada vista tiene una ruta absoluta dentro de la aplicación, mediante Next.js
Link/router. Por ejemplo: `/maestro/materias/1/datos`,
`/maestro/materias/1/clases/nueva`, `/maestro/materias/1/clases/2/editar` y
`/maestro/materias/1/examenes/importar`. Atrás, Adelante y recargar recuperan la vista
indicada por la URL. El editor de clases conserva borradores de texto y referencias en la sesión del navegador,
aislados por campus, usuario, materia y clase. Al volver con Atrás se recuperan;
Guardar y Descartar los retiran. Los archivos todavía no cargados deben seleccionarse
otra vez. Los cambios guardados se recuperan de la base de datos. En
`/maestro/tareas` se muestran primero las entregas pendientes, con filtros por
alumno, clase y módulo.

Las asignaciones de **Alumnos y grupos** muestran si hay cambios pendientes y
confirman el guardado sin borrar el aviso al actualizar los datos. La operación
se guarda en una transacción; un fallo conserva las asignaciones anteriores.
Al guardar, los maestros mantienen los grupos de la materia que administra otro
docente. La migración inicial de `grupo_maestros` solo se ejecuta al crear esa
tabla, para respetar las desasignaciones realizadas por administración.

La opción **Perfil y contraseña** está disponible para maestros y administradores.
Cada usuario cambia su contraseña proporcionando la actual y confirmando la nueva.
El formulario compartido también se usa en el perfil del estudiante. El cambio de
contraseña actualiza únicamente ese campo para conservar los datos del perfil.

En **Gestión de Alumnos** (`/admin/alumnos`) la columna **Grupo** de la tabla es
un selector: cambiarlo reasigna al alumno de inmediato y aprueba su solicitud de
acceso al grupo. Un fallo del servidor devuelve la fila al grupo anterior. El
formulario de edición conserva el mismo selector. Sin grupo, el alumno no ve
materias ni clases, porque el acceso se resuelve por `usuarios.grupo_cohorte` →
`grupos_cohortes` → `curso_grupos`.

Los administradores pueden restablecer contraseñas de otras cuentas en
**Gestión de usuarios → Contraseñas de usuarios**. El servidor verifica el rol y
valida la contraseña antes de guardarla con bcrypt. No se envían correos desde
este formulario.

En producción las rutas se sirven bajo el base path de cada instalación. Las credenciales de
cuentas reales se gestionan en la base de datos y no se guardan en el código.
