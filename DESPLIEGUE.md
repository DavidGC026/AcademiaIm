# Despliegue de Academia IMCYC en el servidor

Esta guía describe la actualización de una instalación existente en Linux con
Next.js, MariaDB, PM2 y Apache. Se publica un commit completo de Git; subirlo a
GitHub por sí solo no actualiza el servidor.

Los nombres `servidor.example` y `root@servidor.example` son ejemplos. Sustitúyelos
por el dominio y el acceso SSH autorizados del servidor.

## Configuración de la instalación

| Elemento | Valor |
| --- | --- |
| Carpeta de la aplicación | `/var/www/academia` |
| Ruta pública | `https://servidor.example/Academia` |
| Proceso PM2 | `academia-lms` |
| Escucha de Next.js | `127.0.0.1:3005` |
| Configuración privada | `/var/www/academia/.env.local` |
| Archivos cargados | `/var/www/academia/public/uploads` |
| Documentos privados | `/var/www/academia/storage` |
| Respaldos de despliegue | `/var/backups/academia/` |

El script está preparado para esta instalación, con MariaDB local en el puerto
3306. La carpeta de la aplicación puede cambiarse con `DEPLOY_APP_DIR`. Un cambio
de puerto, ruta pública o ubicación de la base requiere adaptar también PM2,
Apache y el procedimiento de respaldo.

## Requisitos previos

- Acceso SSH por llave y permisos para administrar esta aplicación, sus respaldos
  y su proceso PM2. Ejecutar los comandos con el usuario que administra PM2.
- Node.js compatible con el proyecto, Corepack, PM2, Git, rsync, curl, tar y flock.
  La instalación se verificó con Node.js 20.19.2.
- pnpm en la versión indicada por `packageManager` en `package.json`, actualmente
  `10.34.4`. `corepack pnpm` utiliza esa versión sin reemplazar el pnpm global.
- Clientes `mariadb` y `mariadb-dump`, con acceso administrativo local por socket
  para consultar y respaldar la base configurada en `DB_NAME`.
- Espacio libre para la compilación nueva y una copia completa de la instalación,
  incluidos sus archivos cargados y dependencias.
- Una instalación funcional con `.env.local`, `.next` y el proceso `academia-lms`.
  El script de actualización se detiene si faltan.

Verifica las herramientas en el servidor:

```bash
cd /var/www/academia
node --version
corepack pnpm --version
pm2 describe academia-lms
df -h /var/www /var/backups
```

Conserva los valores reales de `.env.local` en el servidor. Incluye las variables
de conexión `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y
`NEXT_PUBLIC_BASE_PATH=/Academia`, además de la configuración de autenticación,
correo e integraciones que utilice la instalación. No copies credenciales a Git
ni reemplaces el entorno de producción por el entorno local.

## Publicar una actualización

Desde la copia local del repositorio:

```bash
git status --short
pnpm test:videos
pnpm test:exams
git push origin main

DEPLOY_SSH_TARGET=root@servidor.example \
DEPLOY_PUBLIC_URL=https://servidor.example/Academia \
./deploy.sh
```

Antes de ejecutarlo, guarda los cambios previstos en un commit y confirma que
estás en la revisión que deseas publicar. El script rechaza un árbol de trabajo
con cambios pendientes; despliega `HEAD`, no descarga una rama por su cuenta.

El procedimiento realiza estos pasos:

1. Envía un archivo de Git del commit a una carpeta de compilación independiente.
   Excluye los archivos subidos, el almacenamiento privado y los archivos de entorno.
2. Impide despliegues simultáneos mediante un bloqueo en el servidor y verifica
   la configuración, la base local y el proceso PM2.
3. Copia `.env.local` desde la aplicación activa al directorio temporal, instala
   con `corepack pnpm install --frozen-lockfile`, ejecuta las pruebas de videos y
   exámenes y compila con `ACADEMIA_SKIP_DB_INIT=1 corepack pnpm build`.
4. Comprueba que el build corresponde a `/Academia`. Durante la compilación se
   omite la inicialización automática de la base; al ejecutar la aplicación,
   `ecosystem.config.cjs` vuelve a habilitarla. Esta opción no desactiva consultas
   explícitas a la base si se añadieran durante la generación de páginas.
5. Respalda la aplicación completa y genera un volcado SQL consistente mediante
   `mariadb-dump --single-transaction`, con rutinas, eventos y disparadores. Guarda
   también la definición de este proceso PM2 en `pm2-app.json`.
6. Conserva los assets estáticos del build anterior para las pestañas que sigan
   abiertas. Detiene únicamente `academia-lms`, sincroniza el código compilado y
   recrea su entrada PM2 con `ecosystem.config.cjs`. Hay una breve interrupción en
   este paso. Recrear la entrada evita que PM2 conserve un lanzador anterior al
   cambiar la ruta del ejecutable; los demás procesos se mantienen.
7. Conserva `.env*`, `public/uploads`, `storage`, el log de correos simulados y
   cualquier `.git` existente. Los archivos de código obsoletos sí se eliminan.
8. Comprueba la página y la API de sesión por el puerto interno y guarda PM2.
   Si se indicó `DEPLOY_PUBLIC_URL`, comprueba también la URL pública por HTTPS.

El script solo anuncia éxito cuando terminan las comprobaciones. Si falla antes
de activar, la aplicación actual sigue disponible. Si falla durante la
activación o la comprobación interna, intenta restaurar automáticamente el código
anterior, su definición PM2 y comprobar nuevamente el servicio. Un fallo en la comprobación pública se informa
como error y requiere revisar Apache, DNS o TLS; no revierte una aplicación que
ya pasó las comprobaciones internas.

Los respaldos y la carpeta de compilación se conservan. Sus rutas aparecen al
terminar. Contienen configuración privada: mantenlos fuera del sitio público y
accesibles solo al administrador. El script no realiza limpieza automática.

## Proxy Apache

Dentro del VirtualHost HTTPS del servidor, la ruta del proxy debe conservar
`/Academia`. La excepción para archivos subidos va antes del proxy general:

```apache
ProxyPreserveHost On
ProxyPass /Academia/uploads !
Alias /Academia/uploads /var/www/academia/public/uploads
<Directory /var/www/academia/public/uploads>
    Options -Indexes +FollowSymLinks
    Require all granted
</Directory>

ProxyPass /Academia http://127.0.0.1:3005/Academia
ProxyPassReverse /Academia http://127.0.0.1:3005/Academia
```

Se requieren los módulos de proxy HTTP y la configuración TLS del sitio. Si
modificas Apache, ejecuta `apache2ctl configtest` antes de `systemctl reload apache2`.
Una actualización normal de código no necesita recargar Apache.

La aplicación acepta videos MP4, WebM y OGV de hasta 250 MB. Revisa que el límite
de cuerpo y los tiempos de espera del proxy permitan el archivo y su envoltura
multipart. Un HTTP 413 puede venir del proxy antes de llegar a la aplicación.

## Comprobaciones posteriores

```bash
ssh root@servidor.example
cat /var/www/academia/.deploy-revision
pm2 describe academia-lms
pm2 logs academia-lms --lines 50 --nostream
curl --fail --show-error --silent http://127.0.0.1:3005/Academia/api/auth/session
curl --fail --show-error --silent --output /dev/null https://servidor.example/Academia
```

Sin sesión, la API debe responder `{"session":null}`. Compara `.deploy-revision`
con `git rev-parse HEAD` de la copia local y de la revisión publicada en GitHub.
Abre la aplicación en el navegador y comprueba el inicio de sesión, las materias,
los recursos existentes y la reproducción de videos. Un HTTP 200 en la portada
no verifica por sí solo los flujos autenticados ni los permisos de Google Drive.

Los exámenes con respuestas de referencia se guardan en
`docs/referencias/examenes/`; no deben volver a colocarse en `public`.

## Restaurar el código anterior

Identifica el respaldo anunciado por el despliegue y sustituye la ruta de ejemplo:

```bash
ssh root@servidor.example
BACKUP_DIR=/var/backups/academia/academia-build-FECHA-COMMIT
test -d "$BACKUP_DIR/app/.next"
test -s "$BACKUP_DIR/pm2-app.json"
pm2 delete academia-lms
rsync -ac --delete \
  --exclude='/.env*' \
  --exclude='/public/uploads/***' \
  --exclude='/storage/***' \
  --exclude='/simulated_emails.log' \
  --exclude='/.git/***' \
  "$BACKUP_DIR/app/" /var/www/academia/
pm2 start "$BACKUP_DIR/pm2-app.json" --only academia-lms
```

Vuelve a comprobar la aplicación y ejecuta `pm2 save` cuando esté sana. La copia
incluye las dependencias y el build anterior; la restauración conserva los
archivos cargados y el entorno actuales.

El volcado `database.sql` se conserva para recuperación de datos. **No se restaura
automáticamente** al revertir código: hacerlo sustituiría datos que pudieron
cambiar después del respaldo. Si una versión incluye migraciones incompatibles,
planifica su recuperación antes de publicar. La inicialización de la base en
`src/lib/db.ts` también puede ejecutar migraciones al arrancar el servicio.
