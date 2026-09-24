import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgainstAd } from '@/lib/ad-auth';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = (body?.username ?? '').trim().toLowerCase();
  const password = body?.password ?? '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
  }

  const result = await authenticateAgainstAd(username, password);
  if (!result.ok || !result.role) {
    return NextResponse.json({ error: result.message }, { status: 401 });
  }

  const token = await createSessionToken({ username, name: result.message, role: result.role });

  const response = NextResponse.json({ ok: true, name: result.message, role: result.role });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
