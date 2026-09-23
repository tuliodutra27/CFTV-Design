// Catálogo de modelos de câmera usados na ALISEO — fonte: netbox_tipos de dispositivos.yaml
// (manufacturer/model/slug) + pesquisa nos datasheets oficiais Hikvision (specs ópticos).
// Idempotente: roda via `prisma.cameraModel.upsert` por slug, pode rodar de novo com segurança.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const cameraModels = [
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD1023G2-LIUF/SL',
    slug: 'ds-2cd1023g2-liufsl',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 103,
    fovHorizontalMinDeg: null,
    resolutionMp: 2,
    irRangeMeters: 30,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/m000077129/DS-2CD1023G2-LIUF_SL_Datasheet-20230811.pdf',
    notes:
      'Vendida em variantes 2.8mm e 4mm sob o mesmo código; escolhida a variante 2.8mm (FOV 103°). Variante 4mm: FOV 83°. Alcance é luz híbrida IR+branca (Smart Hybrid Light), não IR puro.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD1041G0-I',
    slug: 'ds-2cd1041g0-i',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 104,
    fovHorizontalMinDeg: null,
    resolutionMp: 4,
    irRangeMeters: 20,
    datasheetUrl:
      'https://assets.hikvision.com/prd/normal/all/doc/m000119340/DS-2CD1041G0-I_Datasheet_20260409.pdf',
    notes:
      'Vendida em variantes 2.8mm e 4mm; escolhida 2.8mm (FOV 104°). Variante 4mm: FOV 82°. Sensor real ~3.7MP, comercializado como 4MP.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD1043G1-I',
    slug: 'ds-2cd1043g1-i',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 98,
    fovHorizontalMinDeg: null,
    resolutionMp: 4,
    irRangeMeters: 30,
    datasheetUrl: 'https://assets.hikvision.com/prd/public/all/doc/m000050678/DS-2CD1043G1-I.pdf',
    notes: 'Vendida em variantes 2.8mm e 4mm; escolhida 2.8mm (FOV 98°). Variante 4mm: FOV 78.7°.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD1043G2-IS',
    slug: 'ds-2cd1043g2-is',
    lensType: null,
    focalLengthMinMm: null,
    focalLengthMaxMm: null,
    fovHorizontalMaxDeg: null,
    fovHorizontalMinDeg: null,
    resolutionMp: null,
    irRangeMeters: null,
    datasheetUrl: null,
    notes:
      'ATENÇÃO: SKU "-IS" não encontrado em nenhum datasheet/site oficial Hikvision — provável erro de digitação no NetBox. A família 1043G2 bullet só existe oficialmente como DS-2CD1043G2-I, -I(UF) e -LIU(F)/SL. Se for DS-2CD1043G2-I(UF): variante 2.8mm tem FOV 99°, 4MP, IR até 30m. Confirmar o modelo real antes de usar este registro.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD1043G2-LIUF/SL',
    slug: 'ds-2cd1043g2-liufsl',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 98,
    fovHorizontalMinDeg: null,
    resolutionMp: 4,
    irRangeMeters: 30,
    datasheetUrl:
      'https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000002/S000000003/S000000004/OFR010251/M000077130/Data_Sheet/DS-2CD1043G2-LIUF_SL_Datasheet-20230811.pdf',
    notes:
      'Vendida em variantes 2.8mm e 4mm; escolhida 2.8mm (FOV 98°). Variante 4mm: FOV 78°. Alcance é luz híbrida IR+branca, não IR puro.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD2T47G2P-LSU/SL',
    slug: 'ds-2cd2t47g2p-lsusl',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 180,
    fovHorizontalMinDeg: null,
    resolutionMp: 4,
    irRangeMeters: 40,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/sm000058407/DS-2CD2T47G2P-LSU_SL-C_Datasheet_20240731.pdf',
    notes:
      'ColorVu panorâmica de lente dupla fixa (2x 2.8mm) costurando 180°H/81°V, sem zoom. Sem IR — supplement light é só luz branca, alcance até 40m (não é alcance de IR real).',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD3066G2-IS',
    slug: 'ds-2cd3066g2-is',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 105,
    fovHorizontalMinDeg: null,
    resolutionMp: 6,
    irRangeMeters: 50,
    datasheetUrl:
      'https://www.hikvision.com/content/dam/hikvision/en/support/regional-materials/mea/DS-2CD3066G2-ISH_Datasheet_MEA_2024Q1.pdf',
    notes:
      'Vendida em variantes 2.8/4/6mm; escolhida 2.8mm (FOV 105°, IR até 50m). Variantes 4mm: FOV 78°; 6mm: FOV 51°. Sensor real ~5.76MP, comercializado como 6MP.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD3156G2-IS',
    slug: 'ds-2cd3156g2-is',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 98,
    fovHorizontalMinDeg: null,
    resolutionMp: 5,
    irRangeMeters: 40,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/sm000042240/DS-2CD3156G2-ISU-C_Datasheet_V5.5.112_20230214.pdf',
    notes:
      'Dome. Vendida em variantes 2.8/4/6mm; escolhida 2.8mm (FOV 98°, IR até 40m). Variantes 4mm: FOV 80°; 6mm: FOV 51°.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD3656G2T-IZS',
    slug: 'ds-2cd3656g2t-izs',
    lensType: 'VARIFOCAL',
    focalLengthMinMm: 2.7,
    focalLengthMaxMm: 13.5,
    fovHorizontalMaxDeg: 103,
    fovHorizontalMinDeg: 32,
    resolutionMp: 5,
    irRangeMeters: 60,
    datasheetUrl: 'https://www.hikvision.com/content/dam/hikvision/pt-br/data-sheets/DS-2CD3656G2T-IZS-C_Datasheet.pdf',
    notes:
      'Varifocal motorizada, vendida em 2.7-13.5mm (escolhida, uso geral, FOV 103° a 32°, IR até 60m) e 7-35mm (telefoto, FOV 28° a 10°, IR até 80m).',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD3666G2T-IZS',
    slug: 'ds-2cd3666g2t-izs',
    lensType: 'VARIFOCAL',
    focalLengthMinMm: 7,
    focalLengthMaxMm: 35,
    fovHorizontalMaxDeg: 34.4,
    fovHorizontalMinDeg: 12.5,
    resolutionMp: 6,
    irRangeMeters: 80,
    datasheetUrl:
      'https://www.hikvision.com/content/dam/hikvision/mena/support/sira/admcc-2023-oliver/DS-2CD3666G2T-IZSYH_SNMP_Datasheet_20230912.pdf',
    notes:
      'Escolhida a variante 7-35mm (telefoto) porque o link de produto original do usuário aponta pra ela. Existe também 2.7-13.5mm (FOV 106° a 35.6°, IR até 60m). O "-Y" no datasheet fonte é só anticorrosão NEMA 4X, ótica idêntica ao "-IZS" puro do NetBox.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2CD3T47EWDV3-L',
    slug: 'ds-2cd3t47ewdv3-l',
    lensType: 'FIXED',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 2.8,
    fovHorizontalMaxDeg: 105.7,
    fovHorizontalMinDeg: null,
    resolutionMp: 4,
    irRangeMeters: 30,
    datasheetUrl: 'https://dv.zol.com.cn/863/8639174.html',
    notes:
      'CONFIANÇA MENOR: sem datasheet oficial Hikvision global/BR encontrado — parece modelo de mercado doméstico chinês (linha ColorVu). Dados triangulados de 2 fichas de distribuidor chinês. Variantes de lente 2.8/4/6/8mm; escolhida 2.8mm. Validar com fornecedor antes de usar em produção.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2DE7A432IW-AEB',
    slug: 'ds-2de7a432iw-aeb',
    lensType: 'MOTORIZED_ZOOM',
    focalLengthMinMm: 5.9,
    focalLengthMaxMm: 188.8,
    fovHorizontalMaxDeg: 50.8,
    fovHorizontalMinDeg: 2.6,
    resolutionMp: 4,
    irRangeMeters: 200,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/m000048587/Datasheet-of-DS-2DE7A432IW-AEBT5_V5.7.0_20240313.pdf',
    notes: 'PTZ speed dome, zoom óptico 32x (5.9-188.8mm) + 16x digital. IR até 200m.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'DS-2SE4C425MWG-E/26(F0)',
    slug: 'ds-2se4c425mwg-e26f0',
    lensType: 'MOTORIZED_ZOOM',
    focalLengthMinMm: 4.8,
    focalLengthMaxMm: 120,
    fovHorizontalMaxDeg: 55,
    fovHorizontalMinDeg: 2.4,
    resolutionMp: 4,
    irRangeMeters: 100,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/m000070247/DS-2SE4C425MWG-E_26F0_Datasheet_20241017.pdf',
    notes:
      'Câmera híbrida TandemVu com 2 canais: bullet panorâmico fixo 2.8mm (FOV 180±10°, sem IR, ~6MP) + PTZ zoom óptico 25x (4.8-120mm, FOV 55° a 2.4°, 4MP, IR até 100m — dados usados aqui, é o canal com cone ajustável). O "/26" no nome é código de variante/região, não razão de zoom.',
  },
  {
    manufacturer: 'Hikvision',
    model: 'iDS-2CD7146G0-IZS',
    slug: 'ids-2cd7146g0-izs',
    lensType: 'VARIFOCAL',
    focalLengthMinMm: 2.8,
    focalLengthMaxMm: 12,
    fovHorizontalMaxDeg: 114.5,
    fovHorizontalMinDeg: 41.8,
    resolutionMp: 4,
    irRangeMeters: 30,
    datasheetUrl:
      'https://assets.hikvision.com/prd/public/all/doc/m000019601/iDS-2CD7146G0-IZS-C_Datasheet_20231122.pdf',
    notes:
      'Dome DeepinView varifocal motorizada. Vendida em 2.8-12mm (escolhida, FOV 114.5° a 41.8°, IR até 30m) e 8-32mm (telefoto, FOV 42.5° a 15.1°, IR até 50m).',
  },
  {
    manufacturer: 'Hikvision',
    model: 'iDS-2CD7A46G0/P-IZHS',
    slug: 'ids-2cd7a46g0p-izhs',
    lensType: 'VARIFOCAL',
    focalLengthMinMm: 8,
    focalLengthMaxMm: 32,
    fovHorizontalMaxDeg: 42.5,
    fovHorizontalMinDeg: 15.1,
    resolutionMp: 4,
    irRangeMeters: 100,
    datasheetUrl:
      'https://www.hikvision.com/content/dam/hikvision/pt-br/data-sheets/iDS-2CD7A46G0_P-IZHSY-C_Datasheet_V5.7.81_20220826.pdf',
    notes:
      'Câmera ANPR/LPR DeepinView. Vendida em 2.8-12mm (uso geral, FOV 114.5° a 41.8°, IR até 50m) e 8-32mm (escolhida — típica para leitura de placa a distância, FOV 42.5° a 15.1°, IR até 100m). Faixa de velocidade suportada: 5-80km/h.',
  },
];

async function main() {
  for (const data of cameraModels) {
    await prisma.cameraModel.upsert({
      where: { slug: data.slug },
      create: data,
      update: data,
    });
  }
  console.log(`Seed concluído: ${cameraModels.length} modelos de câmera.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
