import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cameraUpdateSchema } from '@/types/camera';
import { isAuthError, requireAdminSession } from '@/lib/getSession';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = await request.json();
  const parsed = cameraUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const camera = await prisma.camera.update({
    where: { id: params.id },
    data: parsed.data,
    include: { cameraModel: true },
  });

  return NextResponse.json(camera);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  await prisma.camera.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
