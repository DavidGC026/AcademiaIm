#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

app_dir=${1:?Falta el directorio de la aplicación}
build_dir=${2:?Falta el directorio de compilación}
revision=${3:?Falta el commit}
phase=${4:-deploy}
case "$app_dir" in
  /var/www/academia) campus_slug=academia; base_path=/Academia; pm2_name=academia-lms; port=3005 ;;
  /var/www/html/ruadiplo) campus_slug=ruadiplo; base_path=/ruadiplo; pm2_name=ruadiplo-lms; port=3006 ;;
  *) echo 'Directorio de campus no reconocido.' >&2; exit 1 ;;
esac
[[ $phase == deploy || $phase == prepare || $phase == activate ]]
[[ $revision =~ ^[a-f0-9]{40}$ ]]
build_root=/var/lib/imcyc-campus/builds
release=$(basename -- "$build_dir")
[[ $release =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]]
[[ $build_dir == "$build_root/$campus_slug/$release" && -d $build_dir ]]
[[ $(realpath -- "$build_dir") == "$build_dir" && $(realpath -- "$app_dir") == "$app_dir" ]]
[[ -f "$app_dir/.env.local" && -s "$app_dir/.next/BUILD_ID" ]]
backup_dir="/var/backups/imcyc-campus/$campus_slug/$release"
preserve=(--exclude='/.env*' --exclude='/public/uploads/***' --exclude='/storage/***'
  --exclude='/runtime/***' --exclude='/.runtime/***' --exclude='/logs/***'
  --exclude='/simulated_emails.log' --exclude='/.git/***'
  --exclude='/.deploy-source.json' --exclude='/.deploy-prepared.json')
restore_needed=0

install -d -m 700 -- /var/lock/imcyc-campus
exec 9>"/var/lock/imcyc-campus/$campus_slug.lock"
flock -n 9 || { echo "Ya hay otro despliegue de $campus_slug en curso." >&2; exit 1; }

check_service() {
  local attempt
  for attempt in {1..30}; do
    if curl --fail --silent --max-time 5 --output /dev/null "http://127.0.0.1:$port$base_path" && \
       curl --fail --silent --max-time 5 "http://127.0.0.1:$port$base_path/api/auth/session" | \
         node -e 'let body="";process.stdin.on("data",chunk=>body+=chunk);process.stdin.on("end",()=>{try{if(JSON.parse(body).session!==null)process.exitCode=1}catch{process.exitCode=1}})'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_pm2() {
  env -i PATH="$PATH" HOME="$HOME" PM2_HOME="${PM2_HOME:-$HOME/.pm2}" pm2 start "$@"
}

restore_process() {
  if start_pm2 "$backup_dir/pm2-app.json" --only "$pm2_name" --env production && check_service; then return 0; fi
  pm2 delete "$pm2_name" >/dev/null 2>&1 || true
  if [[ -f "$backup_dir/app/ecosystem.config.cjs" ]]; then
    start_pm2 "$backup_dir/pm2-fallback.config.cjs" --only "$pm2_name" --env production && check_service
  else
    return 1
  fi
}

rollback_on_error() {
  local status=$?
  trap - EXIT ERR INT TERM
  if (( status == 0 )); then return; fi
  set +e
  if (( restore_needed )); then
    echo "Falló la activación; restaurando código y PM2 desde $backup_dir..." >&2
    pm2 delete "$pm2_name" >/dev/null 2>&1 || true
    if rsync -ac --delete "${preserve[@]}" "$backup_dir/app/" "$app_dir/" && \
       restore_process; then
      pm2 save
      echo 'Código y proceso anteriores restaurados; servicio verificado.' >&2
    else
      echo "La restauración requiere atención. Respaldo y ecosystem original: $backup_dir/app" >&2
    fi
  fi
  echo "Despliegue fallido. Build privado conservado en $build_dir. SQL no restaurado." >&2
  exit "$status"
}
trap rollback_on_error EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for executable in node corepack pm2 rsync curl mariadb-dump mariadb flock realpath; do
  command -v "$executable" >/dev/null
done

# No heredar accidentalmente la conexión o el JWT del otro campus.
database=$(env -i PATH="$PATH" HOME="$HOME" node --env-file="$app_dir/.env.local" -e '
  if (process.env.NEXT_PUBLIC_BASE_PATH !== process.argv[1]) throw Error("NEXT_PUBLIC_BASE_PATH no coincide con el campus elegido");
  if (!["localhost","127.0.0.1"].includes(process.env.DB_HOST || "127.0.0.1") || (process.env.DB_PORT || "3306") !== "3306") throw Error("El respaldo requiere MariaDB local en 3306");
  const name = process.env.DB_NAME;
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) throw Error("DB_NAME debe identificar la base del campus");
  process.stdout.write(name);
' "$base_path")
mariadb --protocol=socket --user=root --batch --skip-column-names "$database" -e 'SELECT 1' >/dev/null
pm2 jlist | node -e '
  let body="";process.stdin.on("data",chunk=>body+=chunk);process.stdin.on("end",()=>{
    const app=JSON.parse(body).find(entry=>entry.name===process.argv[1]);
    if (!app || app.pm2_env.pm_cwd !== process.argv[2]) throw Error("El proceso PM2 no corresponde a esta instalación");
  });
' "$pm2_name" "$app_dir"

run_pnpm() {
  env -i PATH="$PATH" HOME="$HOME" CI=1 NODE_ENV=production ACADEMIA_SKIP_DB_INIT=1 DB_AUTO_INIT=0 \
    node --env-file=.env.local -e '
      const result=require("node:child_process").spawnSync("corepack",["pnpm",...process.argv.slice(1)],{stdio:"inherit",env:process.env});
      if (result.error) throw result.error;
      process.exit(result.status ?? 1);
    ' "$@"
}

cd -- "$build_dir"
if [[ $phase != activate ]]; then
  cp -- "$app_dir/.env.local" .env.local
  chmod 600 .env.local
  node -e '
    const fs=require("node:fs"), crypto=require("node:crypto");
    const source={appDir:process.argv[1],revision:process.argv[2],basePath:process.argv[3],
      sourceEnvironmentSha256:crypto.createHash("sha256").update(fs.readFileSync(".env.local")).digest("hex"),
      sourceBuildId:fs.readFileSync(process.argv[1]+"/.next/BUILD_ID","utf8").trim()};
    fs.writeFileSync(".deploy-source.json",JSON.stringify(source),{mode:0o600});
  ' "$app_dir" "$revision" "$base_path"
  env -i PATH="$PATH" HOME="$HOME" node --env-file=.env.local -e '
    if (!process.env.JWT_SECRET?.trim()) {
      const fs=require("node:fs"),crypto=require("node:crypto");
      const text=fs.readFileSync(".env.local","utf8").replace(/^\s*(?:export\s+)?JWT_SECRET\s*=.*(?:\r?\n|$)/gm,"");
      fs.writeFileSync(".env.local",text.replace(/\s*$/,"")+"\nJWT_SECRET="+crypto.randomBytes(48).toString("base64url")+"\n",{mode:0o600});
    }
  '
  umask 022
  echo "Instalando, probando y compilando $campus_slug fuera del directorio público..."
  run_pnpm install --frozen-lockfile --prod=false
  run_pnpm test:core
  run_pnpm test:media
  run_pnpm test:exams
  run_pnpm build
  run_pnpm exec tsc --noEmit
  test -s .next/BUILD_ID
  node -e '
    const fs=require("node:fs");
    if (JSON.parse(fs.readFileSync(".next/routes-manifest.json","utf8")).basePath!==process.argv[1]) throw Error("Base path incorrecto en el build");
    const prepared=JSON.parse(fs.readFileSync(".deploy-source.json","utf8"));
    prepared.preparedBuildId=fs.readFileSync(".next/BUILD_ID","utf8").trim();
    prepared.preparedAt=new Date().toISOString();
    fs.writeFileSync(".deploy-prepared.json",JSON.stringify(prepared),{mode:0o600});
    fs.writeFileSync(".deploy-revision",prepared.revision+"\n");
  ' "$base_path"
fi
umask 077
chmod 700 "$build_dir"

node -e '
  const fs=require("node:fs"),crypto=require("node:crypto");
  const prepared=JSON.parse(fs.readFileSync(".deploy-prepared.json","utf8"));
  const [appDir,revision,basePath]=process.argv.slice(1);
  const currentHash=crypto.createHash("sha256").update(fs.readFileSync(appDir+"/.env.local")).digest("hex");
  if (prepared.appDir!==appDir || prepared.revision!==revision || prepared.basePath!==basePath || prepared.sourceEnvironmentSha256!==currentHash || prepared.sourceBuildId!==fs.readFileSync(appDir+"/.next/BUILD_ID","utf8").trim()) throw Error("La instalación o su entorno cambiaron; vuelve a preparar el build");
  if (prepared.preparedBuildId!==fs.readFileSync(".next/BUILD_ID","utf8").trim() || JSON.parse(fs.readFileSync(".next/routes-manifest.json","utf8")).basePath!==basePath || fs.readFileSync(".deploy-revision","utf8").trim()!==revision) throw Error("El build preparado no corresponde a esta revisión");
' "$app_dir" "$revision" "$base_path"

if [[ $phase == prepare ]]; then
  echo "Preparación verificada sin activar ni migrar: $build_dir"
  exit 0
fi

echo "Guardando respaldo privado en $backup_dir..."
install -d -m 700 -- /var/backups/imcyc-campus "/var/backups/imcyc-campus/$campus_slug"
mkdir -m 700 -- "$backup_dir"
rsync -a -- "$app_dir/" "$backup_dir/app/"
cp -- "$app_dir/.env.local" "$backup_dir/env.local"
chmod 600 "$backup_dir/env.local"
chmod 600 "$backup_dir/app/.env.local"
mariadb-dump --protocol=socket --user=root --single-transaction --routines --events --triggers --databases "$database" > "$backup_dir/database.sql"
test -s "$backup_dir/database.sql"
pm2 jlist | node -e '
  let body="";process.stdin.on("data",chunk=>body+=chunk);process.stdin.on("end",()=>{
    const app=JSON.parse(body).find(entry=>entry.name===process.argv[1]);
    if (!app || app.pm2_env.pm_cwd!==process.argv[2]) throw Error("No se encontró el proceso PM2 esperado");
    const e=app.pm2_env;
    const safeEnv={...e.env,NODE_ENV:"production",ACADEMIA_SKIP_DB_INIT:"1",DB_AUTO_INIT:"0"};
    process.stdout.write(JSON.stringify({apps:[{name:app.name,script:e.pm_exec_path,cwd:e.pm_cwd,
      args:e.args||[],interpreter:e.exec_interpreter,exec_mode:e.exec_mode,instances:e.instances||1,
      env:safeEnv,env_production:safeEnv,out_file:e.pm_out_log_path,error_file:e.pm_err_log_path}]},null,2));
  });
' "$pm2_name" "$app_dir" > "$backup_dir/pm2-app.json"
chmod 600 "$backup_dir/database.sql" "$backup_dir/pm2-app.json"
test -s "$backup_dir/pm2-app.json"
node -e '
  const fs=require("node:fs");
  const [backup,appDir,name,basePath]=process.argv.slice(1);
  const safe={NODE_ENV:"production",ACADEMIA_SKIP_DB_INIT:"1",DB_AUTO_INIT:"0",NEXT_PUBLIC_BASE_PATH:basePath};
  const source=`const config=require(${JSON.stringify(appDir+"/ecosystem.config.cjs")});
const apps=config.apps.filter(app=>app.name===${JSON.stringify(name)});
if(apps.length!==1) throw Error("El ecosystem anterior no contiene el proceso esperado");
for(const app of apps){app.cwd=${JSON.stringify(appDir)};app.env={...app.env,...${JSON.stringify(safe)}};app.env_production={...app.env_production,...${JSON.stringify(safe)}};}
module.exports={apps};\n`;
  fs.writeFileSync(backup+"/pm2-fallback.config.cjs",source,{mode:0o600});
' "$backup_dir" "$app_dir" "$pm2_name" "$base_path"

echo 'Aplicando únicamente la migración aditiva del campus respaldado...'
run_pnpm migrate:campus

if [[ -d "$app_dir/.next/static" ]]; then
  rsync -a --ignore-existing -- "$app_dir/.next/static/" "$build_dir/.next/static/"
fi

echo "Activando sólo $pm2_name..."
restore_needed=1
pm2 stop "$pm2_name"
rsync -ac --delete "${preserve[@]}" "$build_dir/" "$app_dir/"
chmod --reference="$backup_dir/app" "$app_dir"
chown --reference="$backup_dir/app" "$app_dir"
# El entorno conserva todos sus valores y sólo añade JWT cuando faltaba.
node -e '
  const fs=require("node:fs"),crypto=require("node:crypto");
  const target=process.argv[1]+"/.env.local",temporary=target+".deploy-"+process.pid;
  const prepared=JSON.parse(fs.readFileSync(".deploy-prepared.json","utf8"));
  if(crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex")!==prepared.sourceEnvironmentSha256) throw Error("El entorno cambió durante la activación");
  fs.copyFileSync(".env.local",temporary,fs.constants.COPYFILE_EXCL);
  fs.chmodSync(temporary,0o600);
  fs.renameSync(temporary,target);
' "$app_dir"
cd -- "$app_dir"
pm2 delete "$pm2_name"
start_pm2 ecosystem.config.cjs --only "$pm2_name" --env production
check_service
pm2 save
restore_needed=0
echo "Servicio verificado. Campus: $campus_slug. Commit: $revision. Respaldo: $backup_dir"
echo "Build privado conservado: $build_dir"
