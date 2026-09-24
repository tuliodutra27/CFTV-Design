import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Ações em sequência (vários campos de uma câmera editados em blur, ou o modo "marcar local"
// disparando um PATCH por câmera do cluster) não geram um checkpoint cada uma — só a primeira
// dentro dessa janela vira um ponto de restauração, já que ela captura o estado "antes" de todo o
// grupo. Passado esse intervalo, a próxima alteração já abre um checkpoint novo.
const COALESCE_WINDOW_MS = 10_000;

// Limite de retenção — evita a tabela crescer sem fim; os mais antigos vão sendo descartados.
const MAX_CHECKPOINTS = 200;

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

/** Sempre cria um checkpoint novo, ignorando a janela de agrupamento — usado antes de um restore. */
export async function createCheckpoint(label: string, username: string) {
  const snapshot = await takeSnapshot();
  await prisma.checkpoint.create({ data: { label, username, snapshot } });
  await pruneOldCheckpoints();
}

/**
 * Cria um checkpoint só se a última alteração registrada foi há mais de COALESCE_WINDOW_MS — chame
 * isso ANTES de aplicar a mutação, pra que o snapshot capture o estado "antes dela". `labelFn` só é
 * chamada quando um checkpoint novo de fato vai ser criado (pode buscar dados extra pro texto sem
 * pesar nas chamadas que caem na janela de agrupamento, que são a maioria).
 */
export async function maybeCreateCheckpoint(
  username: string,
  labelFn: () => string | Promise<string>,
) {
  const last = await prisma.checkpoint.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < COALESCE_WINDOW_MS) return;

  await createCheckpoint(await labelFn(), username);
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
