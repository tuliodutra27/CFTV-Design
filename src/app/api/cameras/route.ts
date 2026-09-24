import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cameraInputSchema } from '@/types/camera';
import { isAuthError, requireAdminSession } from '@/lib/getSession';
import { maybeCreateCheckpoint } from '@/lib/checkpoint';

export async function GET() {
  const cameras = await prisma.camera.findMany({
    orderBy: { code: 'asc' },
    include: { cameraModel: true },
  });
  return NextResponse.json(cameras);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = await request.json();
  const parsed = cameraInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await maybeCreateCheckpoint(session.username, () => `Nova câmera criada (${parsed.data.code})`);

  const camera = await prisma.camera.create({
    data: parsed.data,
    include: { cameraModel: true },
  });
  return NextResponse.json(camera, { status: 201 });
}
