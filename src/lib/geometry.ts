/**
 * Geometria do cone de FOV das câmeras.
 *
 * Fase 1 (MVP): cone simples (setor circular), sem considerar obstáculos.
 * Fase 2: o resultado deste setor vira input do `visibility-polygon` para recortar
 * o cone nos segmentos de `Obstacle`, gerando o polígono cacheado em `CoverageZone`.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Retorna os pontos do polígono do setor circular que representa o FOV de uma câmera,
 * em metros, no mesmo referencial de `Camera.positionX/positionY`.
 *
 * @param origin posição da câmera
 * @param azimuthDeg direção central do cone, em graus (0 = norte, sentido horário)
 * @param fovAngleDeg abertura horizontal da lente, em graus
 * @param rangeMeters alcance máximo do cone
 * @param segments quantos segmentos usar para aproximar o arco (mais = mais suave)
 */
export function computeFovSector(
  origin: Point,
  azimuthDeg: number,
  fovAngleDeg: number,
  rangeMeters: number,
  segments = 24,
): Point[] {
  const halfFov = fovAngleDeg / 2;
  const startAngle = azimuthDeg - halfFov;
  const endAngle = azimuthDeg + halfFov;

  const points: Point[] = [origin];

  for (let i = 0; i <= segments; i++) {
    const angleDeg = startAngle + ((endAngle - startAngle) * i) / segments;
    // 0° = norte (eixo -Y na tela), sentido horário — convertendo para o referencial matemático padrão.
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    points.push({
      x: origin.x + rangeMeters * Math.cos(angleRad),
      y: origin.y + rangeMeters * Math.sin(angleRad),
    });
  }

  return points;
}

/** Achata uma lista de pontos para o formato [x1, y1, x2, y2, ...] esperado pelo Konva. */
export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}
