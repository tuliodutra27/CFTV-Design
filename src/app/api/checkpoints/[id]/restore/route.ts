import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthError, requireAdminSession } from '@/lib/getSession';
import { createCheckpoint, restoreCheckpoint } from '@/lib/checkpoint';

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const target = await prisma.checkpoint.findUnique({ where: { id: params.id }, select: { label: true } });
  if (!target) {
    return NextResponse.json({ error: 'Checkpoint não encontrado' }, { status: 404 });
  }

  // Sempre grava o estado atual antes de sobrescrever — mesmo restaurar vira um passo reversível,
  // nunca perde o que existia na hora do clique (ignora a janela de agrupamento de propósito).
  await createCheckpoint(`Antes de restaurar para "${target.label}"`, session.username);

  const result = await restoreCheckpoint(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
