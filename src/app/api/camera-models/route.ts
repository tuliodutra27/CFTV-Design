import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const models = await prisma.cameraModel.findMany({
    orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
  });
  return NextResponse.json(models);
}
