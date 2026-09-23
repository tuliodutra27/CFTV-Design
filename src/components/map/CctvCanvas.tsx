'use client';

import { useRef } from 'react';
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

interface CctvCanvasProps {
  width: number;
  height: number;
  cameras: CameraDTO[];
  backgroundImageUrl?: string;
  /** Metros por pixel da imagem de fundo — 1 (sem conversão) quando não há mapa calibrado ainda. */
  scaleMetersPerPixel: number;
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
}

export default function CctvCanvas({
  width,
  height,
  cameras,
  backgroundImageUrl,
  scaleMetersPerPixel,
  selectedCameraId,
  onSelectCamera,
  onCameraMove,
  onCanvasClick,
  calibrating,
  calibrationPoints = [],
  onCalibrationPoint,
}: CctvCanvasProps) {
  const [backgroundImage] = useImage(backgroundImageUrl ?? '');
  const stageRef = useRef<Konva.Stage>(null);

  // A imagem de fundo é renderizada em resolução nativa (sem esticar) — o Stage acompanha o
  // tamanho dela pra permitir rolar/panorâmica; sem imagem, cai no tamanho do container.
  const stageWidth = backgroundImage?.width ?? width;
  const stageHeight = backgroundImage?.height ?? height;

  const toPx = (meters: number) => meters / scaleMetersPerPixel;
  const toMeters = (pixels: number) => pixels * scaleMetersPerPixel;

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    // Só reage a clique no fundo (não em cima de uma câmera existente).
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image' && e.target.getClassName() !== 'Rect') {
      return;
    }
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (calibrating) {
      onCalibrationPoint?.(pointer.x, pointer.y);
    } else if (onCanvasClick) {
      onCanvasClick(toMeters(pointer.x), toMeters(pointer.y));
    }
  }

  return (
    <Stage ref={stageRef} width={stageWidth} height={stageHeight} onClick={handleStageClick}>
      <Layer>
        {backgroundImage ? (
          <KonvaImage image={backgroundImage} />
        ) : (
          <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill="#0f172a" />
        )}
      </Layer>

      <Layer>
        {cameras.map((camera) => {
          const sector = computeFovSector(
            { x: camera.positionX, y: camera.positionY },
            camera.azimuth,
            camera.fovAngle,
            camera.rangeMeters,
          ).map((p) => ({ x: toPx(p.x), y: toPx(p.y) }));
          const color = STATUS_COLORS[camera.status] ?? STATUS_COLORS.PLANNED;
          const isSelected = camera.id === selectedCameraId;
          const px = toPx(camera.positionX);
          const py = toPx(camera.positionY);

          return (
            <Group key={camera.id} listening>
              <Line
                points={flattenPoints(sector)}
                closed
                fill={color}
                opacity={isSelected ? 0.35 : 0.18}
                stroke={color}
                strokeWidth={isSelected ? 2 : 1}
              />
              <Circle
                x={px}
                y={py}
                radius={isSelected ? 7 : 5}
                fill={color}
                stroke="#0f172a"
                strokeWidth={1}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectCamera?.(camera.id);
                }}
                onDragEnd={(e) => {
                  onCameraMove?.(camera.id, toMeters(e.target.x()), toMeters(e.target.y()));
                }}
              />
              <Text x={px + 8} y={py - 6} text={camera.name} fontSize={12} fill="#e2e8f0" />
            </Group>
          );
        })}
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
