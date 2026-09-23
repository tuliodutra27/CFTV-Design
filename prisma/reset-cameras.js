// Apaga todas as Camera (e CoverageZone em cascata) — usado antes de reimportar do NetBox pra
// não misturar câmeras de teste criadas manualmente no canvas com o import real.
// NÃO mexe no catálogo CameraModel nem em Obstacle/BackgroundMap.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const { count } = await prisma.camera.deleteMany({});
  console.log(`Removidas ${count} câmeras.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
