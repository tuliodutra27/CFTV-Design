import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  scaleMetersPerPixel: z.number().positive(),
});

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const map = await prisma.backgroundMap.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(map);
}
