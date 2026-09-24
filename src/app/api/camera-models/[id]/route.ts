import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAuthError, requireAdminSession } from '@/lib/getSession';
import { createCheckpoint } from '@/lib/checkpoint';

const patchSchema = z.object({
  fovHorizontalMaxDeg: z.number().positive().nullable().optional(),
  fovHorizontalMinDeg: z.number().positive().nullable().optional(),
  irRangeMeters: z.number().positive().nullable().optional(),
  // Quando true, também atualiza fovAngle/rangeMeters de toda Camera que já usa este modelo —
  // sem isso, a correção só valeria pra próxima vez que alguém selecionar o modelo.
  applyToExistingCameras: z.boolean().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { applyToExistingCameras, ...data } = parsed.data;

  const beforeEdit = await prisma.cameraModel.findUnique({
    where: { id: params.id },
    select: { manufacturer: true, model: true },
  });
  await createCheckpoint(
    `Modelo "${beforeEdit ? `${beforeEdit.manufacturer} ${beforeEdit.model}` : params.id}" atualizado`,
    session.username,
  );

  const model = await prisma.cameraModel.update({
    where: { id: params.id },
    data,
  });

  if (applyToExistingCameras) {
    await prisma.camera.updateMany({
      where: { cameraModelId: model.id },
      data: {
        ...(model.fovHorizontalMaxDeg != null ? { fovAngle: model.fovHorizontalMaxDeg } : {}),
        ...(model.irRangeMeters != null ? { rangeMeters: model.irRangeMeters } : {}),
      },
    });
  }

  return NextResponse.json(model);
}
