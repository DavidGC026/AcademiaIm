# Despliegue de los campus IMCYC

Academia IMCYC y RUA Diplo usan el mismo código, con entorno, base de datos,
archivos y sesión independientes. Cada despliegue publica un commit de Git en
una instalación existente; un push por sí solo no actualiza el servidor.

## Instalaciones

| Campus | `DEPLOY_APP_DIR` | `NEXT_PUBLIC_BASE_PATH` | PM2 | Escucha interna |
| --- | --- | --- | --- | --- |
| Academia | `/var/www/academia` | `/Academia` | `academia-lms` | `127.0.0.1:3005` |
| RUA Diplo | `/var/www/html/ruadiplo` | `/ruadiplo` | `ruadiplo-lms` | `127.0.0.1:3006` |

El script acepta únicamente esas dos carpetas y comprueba que `.env.local`, el
proceso PM2 y el build corresponden al campus elegido. Conserva los valores de
conexión e integraciones de cada instalación. No copia entornos de una a otra.

Los nombres `servidor.example` y `root@servidor.example` de esta guía son ejemplos;
sustitúyelos por el acceso autorizado.

## Requisitos

- Acceso SSH por llave como el usuario que administra PM2, con permisos para
  respaldar y actualizar la instalación.
- Node.js compatible con Next.js, Corepack, PM2, Git, rsync, curl, tar y flock.
- La versión de pnpm indicada en `packageManager`; usar `corepack pnpm`, sin npm
  ni yarn. También se instalan las dependencias de desarrollo para las pruebas.
- `mariadb` y `mariadb-dump`, con acceso administrativo local como root por socket.
  La aplicación debe usar MariaDB local en el puerto 3306 y declarar `DB_NAME`.
- La aplicación existente debe tener `.env.local`, `.next/BUILD_ID` y su proceso
  PM2. Este procedimiento actualiza instalaciones; no crea bases ni usuarios.
- Espacio para un build y un respaldo completo, incluidas dependencias, archivos
  cargados y almacenamiento privado.
- Poppler (`pdftoppm`) o Ghostscript (`gs`) para generar portadas de PDF.

El entorno de cada campus contiene sus variables `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`, `NEXT_PUBLIC_BASE_PATH` y `JWT_SECRET`, además de sus
integraciones. Si falta `JWT_SECRET`, se genera una clave aleatoria dentro del
entorno privado del build. Sólo se instala en el campus después de respaldarlo;
el script no imprime su valor. `.env.local` queda con permisos 600.

## Preparar y revisar una actualización

Guarda los cambios en un commit y sitúate en la revisión que se publicará. El
script rechaza cambios pendientes y envía únicamente `git archive HEAD`; no
descarga ni elige una rama remota.

```bash
git status --short
pnpm test:core
pnpm test:media
pnpm test:exams

DEPLOY_SSH_TARGET=root@servidor.example \
DEPLOY_APP_DIR=/var/www/academia \
DEPLOY_PREPARE_ONLY=1 \
./deploy.sh
```

Para RUA, cambia `DEPLOY_APP_DIR` a `/var/www/html/ruadiplo`. Si necesitas un archivo
de configuración SSH específico, añade `DEPLOY_SSH_CONFIG=/ruta/config-ssh`.
`DEPLOY_SSH_CONFIG=/dev/null` permite omitir la configuración SSH global.

La preparación instala dependencias, ejecuta `test:core`, `test:media` y
`test:exams`, compila con pnpm y ejecuta TypeScript. Verifica el `basePath` del
build. Trabaja exclusivamente en:

```text
/var/lib/imcyc-campus/builds/<campus>/<fecha-UTC>-<commit-corto>/
```

Estos directorios tienen permisos 700 y están fuera del directorio público. No
se detiene PM2, no se cambia el entorno activo y no se ejecuta la migración en
modo preparación. La salida incluye el comando exacto de activación posterior:

```bash
bash /var/lib/imcyc-campus/builds/academia/FECHA-COMMIT/scripts/deploy-server.sh \
  /var/www/academia \
  /var/lib/imcyc-campus/builds/academia/FECHA-COMMIT \
  COMMIT_COMPLETO activate
```

El modo `activate` reutiliza las pruebas y el build preparados. Comprueba el
commit, el `basePath`, los identificadores de build y el SHA-256 del entorno
original. Si otra actualización cambió la instalación o su entorno, exige una
nueva preparación.

## Publicar directamente

Para preparar y activar en una sola ejecución, omite `DEPLOY_PREPARE_ONLY`:

```bash
DEPLOY_SSH_TARGET=root@servidor.example \
DEPLOY_APP_DIR=/var/www/academia \
DEPLOY_PUBLIC_URL=https://servidor.example/Academia \
./deploy.sh
```

Para el otro campus:

```bash
DEPLOY_SSH_TARGET=root@servidor.example \
DEPLOY_APP_DIR=/var/www/html/ruadiplo \
DEPLOY_PUBLIC_URL=https://servidor.example/ruadiplo \
./deploy.sh
```

Después de preparar, la activación hace lo siguiente:

1. Adquiere un bloqueo exclusivo para ese campus. Verifica la conexión local y
   que el proceso PM2 esperado pertenece a la carpeta elegida.
2. Respalda la aplicación completa, una copia privada de `.env.local`, la base
   mediante `mariadb-dump --single-transaction` y la definición original de PM2 en
   `/var/backups/imcyc-campus/<campus>/<fecha-UTC>-<commit-corto>/`.
3. Carga el entorno del campus y ejecuta `pnpm migrate:campus`. Esta migración
   añade las columnas y tablas necesarias sin sembrar datos ni modificar las
   filas originales. `initDb` y las semillas permanecen desactivados con
   `ACADEMIA_SKIP_DB_INIT=1` y `DB_AUTO_INIT=0`, también al arrancar PM2.
4. Conserva los chunks estáticos anteriores que puedan necesitar pestañas
   abiertas. Detiene únicamente `academia-lms` o `ruadiplo-lms`, sincroniza el
   código, instala el entorno preparado y recrea ese proceso con
   `pm2 start ecosystem.config.cjs --only <proceso> --env production`.
5. Conserva `.env*`, `public/uploads`, `storage`, `runtime`, `.runtime`, `logs`,
   `simulated_emails.log` y cualquier `.git` existente. Elimina el código obsoleto.
6. Comprueba la portada y `/api/auth/session` por el puerto interno y guarda PM2.
   Si se indicó `DEPLOY_PUBLIC_URL`, el lanzador comprueba después esa URL.

La activación produce una breve interrupción del campus elegido. No detiene el
otro campus ni otros procesos PM2. La configuración PM2 obtiene nombre, puerto y
ruta del `basePath` embebido en el build.

Si falla la activación o su comprobación interna, se restauran automáticamente
el código y la definición PM2 anteriores. Se conserva también el ecosystem
original como alternativa de arranque, con inicialización automática desactivada.
La base **no se restaura automáticamente**: sus cambios de esquema son aditivos
y un volcado podría sustituir datos creados después del respaldo. Si falla sólo
la comprobación pública, se informa el error para revisar proxy, DNS o TLS sin
revertir el servicio que ya superó la comprobación interna.

Los builds y respaldos se conservan; el procedimiento no los elimina. Contienen
configuración privada y deben permanecer fuera del sitio público.

## Proxy Apache

Cada ruta debe llegar al mismo `basePath` del servicio. Conserva las excepciones
de archivos cargados antes del proxy general:

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

ProxyPass /ruadiplo/uploads !
Alias /ruadiplo/uploads /var/www/html/ruadiplo/public/uploads
<Directory /var/www/html/ruadiplo/public/uploads>
    Options -Indexes +FollowSymLinks
    Require all granted
</Directory>
ProxyPass /ruadiplo http://127.0.0.1:3006/ruadiplo
ProxyPassReverse /ruadiplo http://127.0.0.1:3006/ruadiplo
```

Una actualización normal no necesita modificar Apache. Si cambias el proxy,
ejecuta `apache2ctl configtest` antes de recargarlo. El límite de cuerpo y los
tiempos de espera deben admitir videos de 250 MB y su envoltura multipart. Un
HTTP 413 puede originarse en el proxy antes de llegar a la aplicación.

## Verificación y recuperación

Comprueba `.deploy-revision`, el proceso elegido y su API interna:

```bash
cat /var/www/academia/.deploy-revision
pm2 describe academia-lms
curl --fail --silent --show-error http://127.0.0.1:3005/Academia/api/auth/session
curl --fail --silent --show-error --output /dev/null https://servidor.example/Academia
```

Sin sesión, la API debe responder `{"session":null}`. Para RUA usa su carpeta,
proceso, puerto 3006 y ruta `/ruadiplo`. Comprueba en navegador el acceso de cada
rol, materias, recursos, videos y exámenes existentes. Las pruebas de creación,
reintentos, edición y borrado se realizan en bases QA aisladas.

Para restaurar código manualmente, usa el respaldo anunciado, conserva las
carpetas persistentes y arranca su definición PM2:

```bash
BACKUP_DIR=/var/backups/imcyc-campus/academia/FECHA-COMMIT
APP_DIR=/var/www/academia
PM2_NAME=academia-lms
test -s "$BACKUP_DIR/pm2-app.json"
pm2 stop "$PM2_NAME"
rsync -ac --delete \
  --exclude='/.env*' --exclude='/public/uploads/***' --exclude='/storage/***' \
  --exclude='/runtime/***' --exclude='/.runtime/***' --exclude='/logs/***' \
  --exclude='/simulated_emails.log' --exclude='/.git/***' \
  "$BACKUP_DIR/app/" "$APP_DIR/"
pm2 delete "$PM2_NAME"
pm2 start "$BACKUP_DIR/pm2-app.json" --only "$PM2_NAME" --env production
```

Verifica el servicio y ejecuta `pm2 save`. Si la definición capturada no arranca,
`pm2-fallback.config.cjs` utiliza el ecosystem original restaurado y mantiene
desactivadas las semillas. Los respaldos incluyen `database.sql` y `env.local`
para una recuperación deliberada; no los importes como parte de un rollback
normal del código.

La validación de esta unificación utiliza copias separadas de ambas bases,
manifiestos de columnas y hashes de filas originales y un inventario SHA-256 de
uploads/storage. El verificador privado `preserve-databases.cjs --verify` permite
volver a comprobarlos después de migrar y retirar los registros ficticios de QA.
La sanitización intencional de claves de integración en QA queda registrada y
se excluye de la comparación del contenido original.

Los documentos de exámenes con claves de respuesta permanecen en
`docs/referencias/examenes/`, fuera de `public`.
