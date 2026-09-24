'use client';

import { useEffect, useRef } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Circle, Line, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import { computeFovSector, flattenPoints, type Point } from '@/lib/geometry';
import type { CameraDTO } from '@/types/camera';

const STATUS_COLORS: Record<string, string> = {
  PLANNED: '#94a3b8',
  ACTIVE: '#22c55e',
  INACTIVE: '#ef4444',
  MAINTENANCE: '#f59e0b',
};

// Qualquer status fora de ACTIVE/PLANNED significa "sem cobertura real agora" — o cone é
// destacado nessa cor de alerta, independente do status exato (INACTIVE, MAINTENANCE, etc.),
// pra chamar atenção mesmo sem abrir o painel de detalhes da câmera.
const INOPERATIVE_CONE_COLOR = '#ef4444';
function isInoperativeStatus(status: string) {
  return status !== 'ACTIVE' && status !== 'PLANNED';
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 10;
const ZOOM_SPEED = 1.05;

// Cores pra distinguir cones de câmeras vizinhas quando um filtro de área está ativo — evita
// verde/vermelho/amarelo/cinza (já usados pelo status) e o amarelo de calibração/marcação.
const FOCUS_PALETTE = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#c084fc', // purple
  '#f472b6', // pink
  '#60a5fa', // blue
  '#e879f9', // fuchsia
  '#34d399', // emerald
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CctvCanvasProps {
  width: number;
  height: number;
  cameras: CameraDTO[];
  backgroundImageUrl?: string;
  /** Metros por pixel da imagem de fundo — 1 (sem conversão) quando não há mapa calibrado ainda. */
  scaleMetersPerPixel: number;
  /** Somente leitura quando false: câmeras não são arrastáveis e clique no fundo não cria câmera. */
  editMode: boolean;
  selectedCameraId?: string | null;
  onSelectCamera?: (id: string) => void;
  /** Posição em metros (já convertida — o chamador não precisa saber da escala). */
  onCameraMove?: (id: string, positionX: number, positionY: number) => void;
  /** Posição em metros (já convertida — o chamador não precisa saber da escala). */
  onCanvasClick?: (positionX: number, positionY: number) => void;
  /** Modo calibração: cliques no fundo viram pontos de calibração (em pixels) em vez de criar câmera. */
  calibrating?: boolean;
  /** Pontos de calibração já marcados, em pixels da imagem. */
  calibrationPoints?: Point[];
  onCalibrationPoint?: (pixelX: number, pixelY: number) => void;
  /** Notifica o zoom atual (só pra exibição — o zoom/pan em si é interno ao componente). */
  onScaleChange?: (scale: number) => void;
  /** Ao mudar (nova referência), centraliza a visão nesse ponto (em metros) sem alterar o zoom. */
  centerOnMeters?: Point | null;
  /** Modo marcar local: clique no fundo reposiciona as câmeras do local selecionado, não cria câmera. */
  markingMode?: boolean;
  onLocationMark?: (positionX: number, positionY: number) => void;
  /** Quando definido, câmeras fora do conjunto ficam esmaecidas e as de dentro ganham cor própria. */
  focusedCameraIds?: Set<string> | null;
  /** Ao mudar (nova referência, em metros), ajusta zoom+posição pra enquadrar essa área. */
  fitBoundsMeters?: Bounds | null;
}

export default function CctvCanvas({
  width,
  height,
  cameras,
  backgroundImageUrl,
  scaleMetersPerPixel,
  editMode,
  selectedCameraId,
  onSelectCamera,
  onCameraMove,
  onCanvasClick,
  calibrating,
  calibrationPoints = [],
  onCalibrationPoint,
  onScaleChange,
  centerOnMeters,
  markingMode,
  onLocationMark,
  focusedCameraIds = null,
  fitBoundsMeters,
}: CctvCanvasProps) {
  const [backgroundImage] = useImage(backgroundImageUrl ?? '');
  const stageRef = useRef<Konva.Stage>(null);

  const toPx = (meters: number) => meters / scaleMetersPerPixel;
  const toMeters = (pixels: number) => pixels * scaleMetersPerPixel;

  useEffect(() => {
    if (!centerOnMeters) return;
    const stage = stageRef.current;
    if (!stage) return;
    const scale = stage.scaleX();
    stage.position({
      x: width / 2 - (centerOnMeters.x / scaleMetersPerPixel) * scale,
      y: height / 2 - (centerOnMeters.y / scaleMetersPerPixel) * scale,
    });
    stage.batchDraw();
  }, [centerOnMeters, scaleMetersPerPixel, width, height]);

  useEffect(() => {
    if (!fitBoundsMeters) return;
    const stage = stageRef.current;
    if (!stage) return;

    const boundsWidthPx = fitBoundsMeters.width / scaleMetersPerPixel;
    const boundsHeightPx = fitBoundsMeters.height / scaleMetersPerPixel;
    if (boundsWidthPx <= 0 || boundsHeightPx <= 0) return;

    const PADDING = 0.85; // deixa uma margem em volta da área, não cola nas bordas
    const newScale = clamp(
      Math.min((width * PADDING) / boundsWidthPx, (height * PADDING) / boundsHeightPx),
      MIN_SCALE,
      MAX_SCALE,
    );
    const centerXPx = (fitBoundsMeters.x + fitBoundsMeters.width / 2) / scaleMetersPerPixel;
    const centerYPx = (fitBoundsMeters.y + fitBoundsMeters.height / 2) / scaleMetersPerPixel;

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: width / 2 - centerXPx * newScale,
      y: height / 2 - centerYPx * newScale,
    });
    stage.batchDraw();
    onScaleChange?.(newScale);
  }, [fitBoundsMeters, scaleMetersPerPixel, width, height]);

  // Zoom com a roda do mouse, centralizado no ponteiro (padrão Konva) — manipula o Stage
  // diretamente via ref, sem guardar escala/posição em estado React (evita brigar com o drag nativo).
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clamp(
      direction > 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED,
      MIN_SCALE,
      MAX_SCALE,
    );

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
    onScaleChange?.(newScale);
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    // Só reage a clique no fundo (não em cima do círculo de uma câmera existente — o cone de FOV
    // e o texto do nome têm listening=false justamente pra nunca serem o alvo aqui).
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image' && e.target.getClassName() !== 'Rect') {
      return;
    }
    const stage = stageRef.current;
    // Relativo ao conteúdo (já descontando o zoom/pan atual do Stage), não à tela.
    const pointer = stage?.getRelativePointerPosition();
    if (!pointer) return;

    if (calibrating) {
      onCalibrationPoint?.(pointer.x, pointer.y);
    } else if (markingMode) {
      onLocationMark?.(toMeters(pointer.x), toMeters(pointer.y));
    } else if (editMode && onCanvasClick) {
      onCanvasClick(toMeters(pointer.x), toMeters(pointer.y));
    }
  }

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      draggable
      onWheel={handleWheel}
      onClick={handleStageClick}
    >
      <Layer>
        {backgroundImage ? (
          <KonvaImage image={backgroundImage} />
        ) : (
          <Rect x={0} y={0} width={width} height={height} fill="#0f172a" />
        )}
      </Layer>

      <Layer>
        {(() => {
          let nextFocusColorIndex = 0;
          return cameras.map((camera) => {
            const sector = computeFovSector(
              { x: camera.positionX, y: camera.positionY },
              camera.azimuth,
              camera.fovAngle,
              camera.rangeMeters,
            ).map((p) => ({ x: toPx(p.x), y: toPx(p.y) }));
            const statusColor = STATUS_COLORS[camera.status] ?? STATUS_COLORS.PLANNED;
            const isSelected = camera.id === selectedCameraId;
            const px = toPx(camera.positionX);
            const py = toPx(camera.positionY);

            const isFocused = focusedCameraIds?.has(camera.id) ?? false;
            const isDimmed = focusedCameraIds != null && !isFocused;
            const focusColor = isFocused
              ? FOCUS_PALETTE[nextFocusColorIndex++ % FOCUS_PALETTE.length]
              : null;
            const isInoperative = isInoperativeStatus(camera.status);
            const coneColor = focusColor ?? (isInoperative ? INOPERATIVE_CONE_COLOR : statusColor);

            return (
              <Group key={camera.id} listening>
                <Line
                  listening={false}
                  points={flattenPoints(sector)}
                  closed
                  fill={coneColor}
                  opacity={
                    isDimmed ? 0.04 : isFocused ? 0.45 : isInoperative ? 0.4 : isSelected ? 0.35 : 0.18
                  }
                  stroke={coneColor}
                  strokeWidth={isFocused ? 2.5 : isInoperative ? 2 : isSelected ? 2 : 1}
                  dash={isFocused ? [10, 6] : undefined}
                />
                <Circle
                  x={px}
                  y={py}
                  radius={isSelected ? 7 : 5}
                  fill={statusColor}
                  stroke="#0f172a"
                  strokeWidth={1}
                  opacity={isDimmed ? 0.15 : 1}
                  draggable={editMode}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectCamera?.(camera.id);
                  }}
                  onDragEnd={(e) => {
                    onCameraMove?.(camera.id, toMeters(e.target.x()), toMeters(e.target.y()));
                  }}
                />
                <Text
                  listening={false}
                  x={px + 8}
                  y={py - 6}
                  text={camera.name}
                  fontSize={12}
                  fill="#e2e8f0"
                  opacity={isDimmed ? 0.15 : 1}
                />
              </Group>
            );
          });
        })()}
      </Layer>

      {calibrating && (
        <Layer>
          {calibrationPoints.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={6} fill="#facc15" stroke="#78350f" strokeWidth={1} />
          ))}
          {calibrationPoints.length === 2 && (
            <Line points={flattenPoints(calibrationPoints)} stroke="#facc15" strokeWidth={2} dash={[8, 5]} />
          )}
        </Layer>
      )}
    </Stage>
  );
}
