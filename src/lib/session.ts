import { SignJWT, jwtVerify } from 'jose';

// Framework-agnóstico de propósito: usado tanto em Route Handlers/Server Components
// (via src/lib/getSession.ts, que lê o cookie com next/headers) quanto no middleware
// (que lê o cookie direto do NextRequest) — o jose funciona nos dois runtimes (Node e Edge).

export type Role = 'admin' | 'operator';

export interface SessionPayload {
  username: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE_NAME = 'cftv_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET não configurado — defina no .env (gere com: openssl rand -hex 32)',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.username === 'string' &&
      typeof payload.name === 'string' &&
      (payload.role === 'admin' || payload.role === 'operator')
    ) {
      return { username: payload.username, name: payload.name, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}
