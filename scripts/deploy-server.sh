#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app_dir=${1:?Falta el directorio de la aplicación}
build_dir=${2:?Falta el directorio de compilación}
revision=${3:?Falta el commit}
[[ $app_dir =~ ^/[a-zA-Z0-9/_-]+$ && $app_dir != / ]]
[[ $build_dir == "$app_dir"-build-* && $revision =~ ^[a-f0-9]{40}$ ]]
[[ -f "$app_dir/.env.local" && -d "$app_dir/.next" ]]
backup_dir="/var/backups/academia/$(basename -- "$build_dir")"
preserve=(--exclude='/.env*' --exclude='/public/uploads/***' --exclude='/storage/***' --exclude='/simulated_emails.log' --exclude='/.git/***')
restore_needed=0

exec 9>/var/lock/academia-deploy.lock
flock -n 9 || { echo 'Ya hay otro despliegue de Academia en curso.' >&2; exit 1; }

check_service() {
  for attempt in {1..30}; do
    if curl --fail --silent --max-time 5 --output /dev/null http://127.0.0.1:3005/Academia && \
       curl --fail --silent --max-time 5 http://127.0.0.1:3005/Academia/api/auth/session | \
         node -e 'let data="";process.stdin.on("data",chunk=>data+=chunk);process.stdin.on("end",()=>{try{if(JSON.parse(data).session!==null)process.exitCode=1}catch{process.exitCode=1}})'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rollback_on_error() {
  local status=$?
  trap - ERR
  if (( restore_needed )); then
    echo "Falló la activación; restaurando el código desde $backup_dir/app..." >&2
    pm2 delete academia-lms || true
    if rsync -ac --delete "${preserve[@]}" "$backup_dir/app/" "$app_dir/" && \
       pm2 start "$backup_dir/pm2-app.json" --only academia-lms && check_service; then
      pm2 save
      echo 'Código y proceso anteriores restaurados; servicio verificado.' >&2
    else
      echo "La restauración requiere atención. Respaldo: $backup_dir" >&2
    fi
  fi
  echo "Despliegue fallido. Compilación conservada en $build_dir" >&2
  exit "$status"
}
trap rollback_on_error ERR

for executable in node corepack pm2 rsync curl mariadb-dump mariadb; do
  command -v "$executable" >/dev/null
done
pm2 describe academia-lms >/dev/null

# Verificar el entorno sin mostrar credenciales. El respaldo usa autenticación
# administrativa local por socket, independiente del usuario de la aplicación.
database=$(cd "$app_dir" && node --env-file=.env.local -e '
  if (process.env.NEXT_PUBLIC_BASE_PATH !== "/Academia") throw Error("Se requiere NEXT_PUBLIC_BASE_PATH=/Academia");
  if (!["localhost", "127.0.0.1"].includes(process.env.DB_HOST || "127.0.0.1") || (process.env.DB_PORT || "3306") !== "3306") throw Error("El respaldo requiere MariaDB local en el puerto 3306");
  const name = process.env.DB_NAME || "academia_imcyc";
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw Error("Nombre de base de datos inválido");
  process.stdout.write(name);
')
mariadb --batch --skip-column-names "$database" -e 'SELECT 1' >/dev/null

cp -- "$app_dir/.env.local" "$build_dir/.env.local"
chmod 600 "$build_dir/.env.local"
cd -- "$build_dir"
umask 022
echo 'Instalando dependencias y compilando fuera de la aplicación activa...'
corepack pnpm install --frozen-lockfile
corepack pnpm test:videos
ACADEMIA_SKIP_DB_INIT=1 corepack pnpm build
node -e 'if (require("./.next/routes-manifest.json").basePath !== "/Academia") throw Error("Base path incorrecto en el build")'
test -s .next/BUILD_ID
printf '%s\n' "$revision" > .deploy-revision

echo "Guardando respaldo en $backup_dir..."
umask 077
mkdir -p -- "$backup_dir"
chmod 700 "$backup_dir"
rsync -a -- "$app_dir/" "$backup_dir/app/"
mariadb-dump --single-transaction --routines --events --triggers --databases "$database" > "$backup_dir/database.sql"
test -s "$backup_dir/database.sql"
pm2 jlist | node -e '
  let data = "";
  process.stdin.on("data", chunk => data += chunk);
  process.stdin.on("end", () => {
    const app = JSON.parse(data).find(app => app.name === "academia-lms");
    if (!app) throw Error("No se encontró academia-lms para respaldar PM2");
    const e = app.pm2_env;
    process.stdout.write(JSON.stringify({ apps: [{
      name: app.name, script: e.pm_exec_path, cwd: e.pm_cwd,
      args: e.args || [], interpreter: e.exec_interpreter,
      exec_mode: e.exec_mode, instances: e.instances || 1,
      env: e.env, out_file: e.pm_out_log_path, error_file: e.pm_err_log_path,
    }] }, null, 2));
  });
' > "$backup_dir/pm2-app.json"
test -s "$backup_dir/pm2-app.json"

# Conservar los assets que todavía puedan pedir pestañas abiertas del build previo.
if [[ -d "$app_dir/.next/static" ]]; then
  rsync -a --ignore-existing -- "$app_dir/.next/static/" "$build_dir/.next/static/"
fi

echo 'Activando la versión preparada...'
restore_needed=1
pm2 stop academia-lms
rsync -ac --delete "${preserve[@]}" "$build_dir/" "$app_dir/"
chmod --reference="$backup_dir/app" "$app_dir"
chown --reference="$backup_dir/app" "$app_dir"
cd -- "$app_dir"
# PM2 conserva pm_exec_path al reiniciar una definición existente. Recrear solo
# esta entrada permite cambiar de lanzador sin reutilizar el comando anterior.
pm2 delete academia-lms
pm2 start ecosystem.config.cjs --only academia-lms

check_service
pm2 save
restore_needed=0
echo "Servicio verificado. Commit: $revision. Respaldo: $backup_dir"
echo "Directorio de compilación conservado: $build_dir"
