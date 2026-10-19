import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getSessionAudience, getSessionCookieName, getSessionCookiePath } from './sessionConfig';

function getSecretKey(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Configura JWT_SECRET antes de iniciar el campus.');
  return secret;
}

export interface JWTPayload {
  userId: number;
  email: string;
  nombre: string;
  roleId: number;
  roleName: 'administrador' | 'maestro' | 'estudiante';
  grupo_cohorte: string | null;
}

export function signToken(payload: JWTPayload): string {
  const { userId, email, nombre, roleId, roleName, grupo_cohorte } = payload;
  return jwt.sign({ userId, email, nombre, roleId, roleName, grupo_cohorte }, getSecretKey(), { expiresIn: '7d', audience: getSessionAudience() });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getSecretKey(), { audience: getSessionAudience() }) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(payload: JWTPayload) {
  const token = signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: getSessionCookiePath(),
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: getSessionCookiePath(), expires: new Date(0),
  });
}
