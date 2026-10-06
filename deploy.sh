#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "$0")"
: "${DEPLOY_SSH_TARGET:?Indica el destino, por ejemplo DEPLOY_SSH_TARGET=root@servidor.example}"
app_dir=${DEPLOY_APP_DIR:-/var/www/academia}
if [[ ! $DEPLOY_SSH_TARGET =~ ^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$ || ! $app_dir =~ ^/[a-zA-Z0-9/_-]+$ || $app_dir == / ]]; then
  echo 'Destino o directorio de despliegue inválido.' >&2
  exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
  echo 'Guarda todos los cambios en un commit antes de desplegar.' >&2
  exit 1
fi

revision=$(git rev-parse HEAD)
release="$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}"
build_dir="${app_dir}-build-${release}"
ssh_options=(-o BatchMode=yes -o ConnectTimeout=15)

echo "Preparando el commit ${revision} en el servidor..."
ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" "mkdir -m 700 -- '$build_dir'"
# Solo se envían archivos del commit; los archivos subidos pertenecen al servidor.
git archive HEAD | ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" \
  "tar -x --exclude='public/uploads' --exclude='storage' --exclude='.env*' -C '$build_dir'"

ssh "${ssh_options[@]}" "$DEPLOY_SSH_TARGET" \
  "bash '$build_dir/scripts/deploy-server.sh' '$app_dir' '$build_dir' '$revision'"

if [[ -n ${DEPLOY_PUBLIC_URL:-} ]]; then
  curl --fail --silent --show-error --location --max-time 30 --output /dev/null "$DEPLOY_PUBLIC_URL"
  echo 'La URL pública respondió correctamente.'
fi
echo "Despliegue verificado en el servidor: ${revision}"
