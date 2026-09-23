import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cameraInputSchema } from '@/types/camera';

export async function GET() {
  const cameras = await prisma.camera.findMany({
    orderBy: { code: 'asc' },
    include: { cameraModel: true },
  });
  return NextResponse.json(cameras);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = cameraInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const camera = await prisma.camera.create({
    data: parsed.data,
    include: { cameraModel: true },
  });
  return NextResponse.json(camera, { status: 201 });
}
