import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthError, requireAdminSession } from '@/lib/getSession';

// Nunca devolve o campo `snapshot` aqui (pode ser um JSON grande com centenas de câmeras) — só o
// necessário pra listar. O snapshot completo só é lido no momento do restore.
export async function GET() {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const checkpoints = await prisma.checkpoint.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, label: true, username: true, createdAt: true },
  });

  return NextResponse.json(checkpoints);
}
