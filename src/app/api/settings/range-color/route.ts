import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/getSession';
import { DEFAULT_RANGE_COLOR } from '@/lib/colors';
import type { SessionPayload } from '@/lib/session';

// Sentinela pra linha global (definida por um admin) — não existe tabela de usuários (auth via AD
// não persiste linha no banco, ver src/lib/session.ts), então a linha pessoal é identificada pelo
// próprio username do AD; "__global__" nunca colide com um sAMAccountName real.
const GLOBAL_KEY = '__global__';

const patchSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor precisa ser um hex de 6 dígitos, ex: #22c55e'),
});

type Scope = 'personal' | 'global' | 'default';

// Prioridade: cor pessoal do usuário > cor global (definida por algum admin) > padrão fixo.
async function resolveEffectiveColor(session: SessionPayload): Promise<{ color: string; scope: Scope }> {
  const personal = await prisma.rangeColorSetting.findUnique({ where: { username: session.username } });
  if (personal) return { color: personal.color, scope: 'personal' };

  const global = await prisma.rangeColorSetting.findUnique({ where: { username: GLOBAL_KEY } });
  if (global) return { color: global.color, scope: 'global' };

  return { color: DEFAULT_RANGE_COLOR, scope: 'default' };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  return NextResponse.json(await resolveEffectiveColor(session));
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Admin grava na linha global (vale pra todo mundo que não tiver cor própria); operador grava só
  // na própria linha, sem afetar ninguém.
  const username = session.role === 'admin' ? GLOBAL_KEY : session.username;
  await prisma.rangeColorSetting.upsert({
    where: { username },
    update: { color: parsed.data.color },
    create: { username, color: parsed.data.color },
  });

  return NextResponse.json(await resolveEffectiveColor(session));
}

// Remove a preferência (pessoal, ou global se for admin) e volta a valer o próximo nível da
// prioridade — dá pra "desfazer" sem precisar adivinhar a cor anterior.
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const username = session.role === 'admin' ? GLOBAL_KEY : session.username;
  await prisma.rangeColorSetting.deleteMany({ where: { username } });

  return NextResponse.json(await resolveEffectiveColor(session));
}
