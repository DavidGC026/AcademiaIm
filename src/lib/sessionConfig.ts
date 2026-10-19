/** Cada campus comparte dominio, pero conserva su propia sesión y cierre de acceso. */
export function getSessionCookieName(basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''): string {
  return `campus_auth_${basePath.toLowerCase().replace(/[^a-z0-9]/g, '') || 'academia'}`;
}

export function getSessionAudience(basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''): string {
  return getSessionCookieName(basePath);
}

export function getSessionCookiePath(basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''): string {
  return basePath.replace(/\/$/, '') || '/';
}
