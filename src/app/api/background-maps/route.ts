import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET() {
  const map = await prisma.backgroundMap.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(map);
}

export async function POST(request: NextRequest) {
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
