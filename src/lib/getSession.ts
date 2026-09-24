import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from './session';

/** Só usável em Server Components e Route Handlers (runtime Node) — não no middleware. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Atalho pros Route Handlers que só admin pode chamar (POST/PATCH/DELETE de dados). */
export async function requireAdminSession(): Promise<SessionPayload | { error: string; status: number }> {
  const session = await getSession();
  if (!session) return { error: 'Não autenticado', status: 401 };
  if (session.role !== 'admin') return { error: 'Apenas administradores podem fazer isso', status: 403 };
  return session;
}

export function isAuthError(value: SessionPayload | { error: string; status: number }): value is { error: string; status: number } {
  return 'error' in value;
}
