# Guía para agentes (Academia IMCYC)

## Stack

- Next.js 16 (App Router), React 19, MySQL, despliegue en `grabador.imcyc.com/Academia`
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
./deploy.sh
```

En el servidor: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm build`, `pm2 restart academia-lms`.

## Convenciones de código

- Cambios mínimos; reutilizar patrones existentes.
- Comentarios `ponytail:` solo para atajos con techo conocido.
- No commitear `.env.local` ni secretos.

## Reglas Cursor

Detalle en `.cursor/rules/` (p. ej. `pnpm.mdc`).
