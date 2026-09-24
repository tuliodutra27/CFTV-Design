import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Limite de retenção — evita a tabela crescer sem fim; os mais antigos vão sendo descartados.
// Cada alteração (mesmo simples, tipo um campo só) grava um checkpoint próprio — sem agrupamento —
// então esse número sobe rápido; 1000 dá bastante margem antes de começar a descartar histórico.
const MAX_CHECKPOINTS = 1000;

export interface CheckpointSnapshot {
  cameras: Prisma.CameraCreateManyInput[];
  cameraModels: Prisma.CameraModelCreateManyInput[];
  backgroundMaps: Prisma.BackgroundMapCreateManyInput[];
}

async function takeSnapshot(): Promise<CheckpointSnapshot> {
  const [cameras, cameraModels, backgroundMaps] = await Promise.all([
    prisma.camera.findMany(),
    prisma.cameraModel.findMany(),
    prisma.backgroundMap.findMany(),
  ]);
  // JSON.stringify/parse converte os Date (createdAt/updatedAt) pra string ISO — Prisma aceita
  // string ISO como input de DateTime na hora de recriar via createMany no restore.
  return JSON.parse(JSON.stringify({ cameras, cameraModels, backgroundMaps }));
}

async function pruneOldCheckpoints() {
  const count = await prisma.checkpoint.count();
  if (count <= MAX_CHECKPOINTS) return;
  const stale = await prisma.checkpoint.findMany({
    orderBy: { createdAt: 'asc' },
    take: count - MAX_CHECKPOINTS,
    select: { id: true },
  });
  await prisma.checkpoint.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
}

/** Grava um checkpoint com o estado atual — chame ANTES de aplicar a mutação. */
export async function createCheckpoint(label: string, username: string) {
  const snapshot = await takeSnapshot();
  await prisma.checkpoint.create({ data: { label, username, snapshot } });
  await pruneOldCheckpoints();
}

/** Reverte Camera + CameraModel + BackgroundMap pro estado gravado no checkpoint. */
export async function restoreCheckpoint(checkpointId: string) {
  const target = await prisma.checkpoint.findUnique({ where: { id: checkpointId } });
  if (!target) return { ok: false as const, error: 'Checkpoint não encontrado' };

  const snapshot = target.snapshot as unknown as CheckpointSnapshot;

  await prisma.$transaction([
    // Câmera primeiro (referencia CameraModel) — senão a FK bloqueia o delete do modelo.
    prisma.camera.deleteMany(),
    prisma.cameraModel.deleteMany(),
    prisma.backgroundMap.deleteMany(),
    prisma.cameraModel.createMany({ data: snapshot.cameraModels }),
    prisma.backgroundMap.createMany({ data: snapshot.backgroundMaps }),
    prisma.camera.createMany({ data: snapshot.cameras }),
  ]);

  return { ok: true as const };
}
