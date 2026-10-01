#!/bin/bash
echo "🚀 Iniciando despliegue de Academia IMCYC..."

# 1. Sincronizar archivos locales con el servidor remoto
echo "📦 Sincronizando archivos con el servidor..."
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.gemini' \
  --exclude '.tempmediaStorage' \
  --exclude 'package-lock.json' \
  --exclude '.env.local' \
  --exclude 'storage' \
  --exclude 'public/uploads' \
  ./ root@grabador.imcyc.com:/var/www/academia/

if [ $? -ne 0 ]; then
    echo "❌ Error al sincronizar los archivos."
    exit 1
fi

# 2. Instalar dependencias y compilar en el servidor (pnpm)
echo "🏗️ Instalando dependencias y compilando en el servidor..."
ssh root@grabador.imcyc.com "cd /var/www/academia && corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && pnpm build"

if [ $? -ne 0 ]; then
    echo "❌ Error al instalar o compilar en el servidor."
    exit 1
fi

# 3. Reiniciar PM2 en el servidor
echo "🔄 Reiniciando el proceso en PM2..."
ssh root@grabador.imcyc.com "pm2 restart academia-lms"

echo "✅ ¡Despliegue completado con éxito! Visita https://grabador.imcyc.com/Academia"
