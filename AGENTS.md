# Guía para agentes (Academia IMCYC)

## Stack

- Next.js 16 (App Router), React 19, MySQL, despliegue bajo `/Academia`
- Base path producción: `NEXT_PUBLIC_BASE_PATH=/Academia`

## Paquetes: pnpm obligatorio

**Usa `pnpm`, no `npm` ni `yarn`.**

| Acción | Comando |
|--------|---------|
| Instalar | `pnpm install` |
| Dev | `pnpm dev` |
| Build | `pnpm build` |
| Añadir dep | `pnpm add <pkg>` |

Lockfile: `pnpm-lock.yaml` (sí commitear). No crear `package-lock.json`.

## Despliegue

```bash
DEPLOY_SSH_TARGET=root@servidor.example DEPLOY_PUBLIC_URL=https://servidor.example/Academia ./deploy.sh
```

Sustituir el destino de ejemplo por el servidor autorizado. Ver `DESPLIEGUE.md`.
El script envía el commit actual, compila en una carpeta aparte con Corepack y pnpm,
respalda aplicación y base, conserva los archivos cargados y verifica PM2 antes de
anunciar éxito. Para compilar sin inicializar la base, usar
`ACADEMIA_SKIP_DB_INIT=1 pnpm build`; el servicio debe ejecutar la inicialización.

## Convenciones de código

- Cambios mínimos; reutilizar patrones existentes.
- Comentarios `ponytail:` solo para atajos con techo conocido.
- No commitear `.env.local` ni secretos.

## Reglas Cursor

Detalle en `.cursor/rules/` (p. ej. `pnpm.mdc`).
