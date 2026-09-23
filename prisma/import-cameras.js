// Importa as câmeras reais do export de devices do NetBox (netbox_cameras.csv), filtradas ao
// grupo "Operacional" e seus subgrupos ("Torres", "Transferência" — o CSV só traz o grupo folha
// de cada dispositivo, a hierarquia foi confirmada manualmente com o Tulio).
//
// Posição ainda não existe (só a localização em texto) — câmeras entram AGRUPADAS POR LOCAL em
// clusters arbitrários no canvas (grid de clusters, grid menor dentro de cada cluster), pra depois
// serem reposicionadas manualmente uma a uma. A localização crua fica em `notes` até lá.
//
// Idempotente: upsert por `code` (usa o "Número de série" do NetBox — confirmado único e sempre
// preenchido nas 350 linhas; `name` fica com o "Nome" legível, ex: "T.18-CAM01").
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, '..', 'netbox_cameras.csv');
const TARGET_GROUPS = new Set(['Operacional', 'Torres', 'Transferência']);

const STATUS_MAP = {
  Ativo: 'ACTIVE',
  Preparado: 'PLANNED',
  Falhou: 'MAINTENANCE',
  Offline: 'INACTIVE',
};

const DEFAULT_FOV_ANGLE = 90;
const DEFAULT_RANGE_METERS = 20;

// Layout provisório: grid de clusters (um por local), grid menor dentro de cada cluster.
const CLUSTER_SPACING = 50;
const CLUSTER_COLUMNS = 8;
const ITEM_SPACING = 6;
const ITEMS_PER_ROW = 4;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignora, \n cuida da quebra de linha
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function slugify(model) {
  return model.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function readDevices() {
  let text = fs.readFileSync(CSV_PATH, 'utf-8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // remove BOM
  const [header, ...rows] = parseCsv(text).filter((r) => r.length > 1 || r[0] !== '');
  return rows.map((row) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? '';
    });
    return obj;
  });
}

async function main() {
  const devices = readDevices();
  const filtered = devices.filter((d) => TARGET_GROUPS.has(d['Grupo de Sites']));
  console.log(`Dispositivos no CSV: ${devices.length}. Após filtro de grupo: ${filtered.length}.`);

  const models = await prisma.cameraModel.findMany();
  const modelBySlug = new Map(models.map((m) => [m.slug, m]));

  const sites = [...new Set(filtered.map((d) => d.Site))].sort((a, b) => a.localeCompare(b));
  const clusterOrigin = new Map(
    sites.map((site, i) => [
      site,
      {
        x: (i % CLUSTER_COLUMNS) * CLUSTER_SPACING,
        y: Math.floor(i / CLUSTER_COLUMNS) * CLUSTER_SPACING,
      },
    ]),
  );
  const siteCounters = new Map();

  let created = 0;
  let unmatchedModels = new Set();

  for (const device of filtered) {
    const origin = clusterOrigin.get(device.Site);
    const indexInSite = siteCounters.get(device.Site) ?? 0;
    siteCounters.set(device.Site, indexInSite + 1);

    const positionX = origin.x + (indexInSite % ITEMS_PER_ROW) * ITEM_SPACING;
    const positionY = origin.y + Math.floor(indexInSite / ITEMS_PER_ROW) * ITEM_SPACING;

    const slug = slugify(device.Tipo);
    const model = modelBySlug.get(slug);
    if (!model) unmatchedModels.add(device.Tipo);

    const notesParts = [`Local (NetBox): ${device.Site}`];
    if (device.Comentários) notesParts.push(`Obs: ${device.Comentários}`);

    const serial = device['Número de série'];
    await prisma.camera.upsert({
      where: { code: serial },
      create: {
        code: serial,
        name: device.Nome,
        cameraModelId: model?.id,
        positionX,
        positionY,
        azimuth: 0,
        fovAngle: model?.fovHorizontalMaxDeg ?? DEFAULT_FOV_ANGLE,
        rangeMeters: model?.irRangeMeters ?? DEFAULT_RANGE_METERS,
        status: STATUS_MAP[device.Status] ?? 'PLANNED',
        notes: notesParts.join(' | '),
      },
      update: {
        cameraModelId: model?.id,
      },
    });
    created++;
  }

  console.log(`Import concluído: ${created} câmeras (criadas ou já existentes, upsert por code).`);
  if (unmatchedModels.size > 0) {
    console.log('ATENÇÃO — modelos sem correspondência no catálogo CameraModel:', [...unmatchedModels]);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
