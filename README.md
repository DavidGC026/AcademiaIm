This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
indicada por la URL. El layout conserva los borradores entre secciones de la misma
materia; los cambios guardados se recuperan de la base de datos. En
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

En producción todas las rutas se sirven bajo `/Academia`. Las credenciales de
cuentas reales se gestionan en la base de datos y no se guardan en el código.
