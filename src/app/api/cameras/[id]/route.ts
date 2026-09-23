import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cameraUpdateSchema } from '@/types/camera';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const body = await request.json();
  const parsed = cameraUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const camera = await prisma.camera.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(camera);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await prisma.camera.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
