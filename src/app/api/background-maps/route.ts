import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthError, requireAdminSession } from '@/lib/getSession';
import { maybeCreateCheckpoint } from '@/lib/checkpoint';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET() {
  const map = await prisma.backgroundMap.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(map);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isAuthError(session)) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const formData = await request.formData();
  const file = formData.get('image');
  const name = formData.get('name');
  const widthPx = Number(formData.get('widthPx'));
  const heightPx = Number(formData.get('heightPx'));

  if (!(file instanceof File) || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'image e name são obrigatórios' }, { status: 400 });
  }
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    return NextResponse.json({ error: 'widthPx e heightPx inválidos' }, { status: 400 });
  }

  // Antes de trocar (o registro antigo fica só desativado, não apagado, mas a escala calibrada
  // some da tela até recalibrar de novo) — dá pra desfazer a troca de imagem com um clique.
  await maybeCreateCheckpoint(session.username, () => `Nova imagem de fundo enviada ("${name}")`);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || '.jpg';
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const map = await prisma.$transaction(async (tx) => {
    await tx.backgroundMap.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.backgroundMap.create({
      data: {
        name,
        imageUrl: `/uploads/${filename}`,
        widthPx,
        heightPx,
        scaleMetersPerPixel: 1, // placeholder até a calibração (2 pontos + distância real)
        isActive: true,
      },
    });
  });

  return NextResponse.json(map, { status: 201 });
}
