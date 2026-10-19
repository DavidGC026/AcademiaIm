#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "$0")"
: "${DEPLOY_SSH_TARGET:?Indica el destino, por ejemplo DEPLOY_SSH_TARGET=root@servidor.example}"
app_dir=${DEPLOY_APP_DIR:-/var/www/academia}
if [[ ! $DEPLOY_SSH_TARGET =~ ^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$ ]]; then
  echo 'Destino SSH inválido.' >&2
  exit 1
fi
case "$app_dir" in
  /var/www/academia) campus_slug=academia ;;
  /var/www/html/ruadiplo) campus_slug=ruadiplo ;;
  *) echo 'DEPLOY_APP_DIR debe identificar una de las dos instalaciones de campus.' >&2; exit 1 ;;
esac
case "${DEPLOY_PREPARE_ONLY:-0}" in
  0) phase=deploy ;;
  1) phase=prepare ;;
  *) echo 'DEPLOY_PREPARE_ONLY debe ser 0 o 1.' >&2; exit 1 ;;
esac
if [[ -n $(git status --porcelain) ]]; then
  echo 'Guarda todos los cambios en un commit antes de desplegar.' >&2
  exit 1
fi

revision=$(git rev-parse HEAD)
release="$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}"
build_root=/var/lib/imcyc-campus/builds
build_dir="$build_root/$campus_slug/$release"
ssh_options=(-o BatchMode=yes -o ConnectTimeout=15)
if [[ -n ${DEPLOY_SSH_CONFIG:-} ]]; then
  [[ -r $DEPLOY_SSH_CONFIG ]] || { echo 'DEPLOY_SSH_CONFIG no se puede leer.' >&2; exit 1; }
  ssh_options=(-F "$DEPLOY_SSH_CONFIG" "${ssh_options[@]}")
fi

echo "Preparando el commit ${revision} en el servidor..."
ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" \
  "install -d -m 700 -- '/var/lib/imcyc-campus' '$build_root' '$build_root/$campus_slug' && mkdir -m 700 -- '$build_dir'"
# Solo se envían archivos del commit; los archivos subidos pertenecen al servidor.
git archive HEAD | ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" \
  "tar -x --exclude='public/uploads' --exclude='storage' --exclude='runtime' --exclude='.runtime' --exclude='logs' --exclude='.env*' -C '$build_dir'"

ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" \
  "bash '$build_dir/scripts/deploy-server.sh' '$app_dir' '$build_dir' '$revision' '$phase'"

if [[ $phase == prepare ]]; then
  echo "Build preparado sin activar: $build_dir"
  echo "Activación posterior en el servidor: bash '$build_dir/scripts/deploy-server.sh' '$app_dir' '$build_dir' '$revision' activate"
  exit 0
fi

if [[ -n ${DEPLOY_PUBLIC_URL:-} ]]; then
  curl --fail --silent --show-error --location --max-time 30 --output /dev/null "$DEPLOY_PUBLIC_URL"
  echo 'La URL pública respondió correctamente.'
fi
echo "Despliegue verificado en el servidor: ${revision}"
