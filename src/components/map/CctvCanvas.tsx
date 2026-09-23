'use client';

import { useRef } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Circle, Line, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import { computeFovSector, flattenPoints } from '@/lib/geometry';
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
  selectedCameraId?: string | null;
  onSelectCamera?: (id: string) => void;
  onCameraMove?: (id: string, positionX: number, positionY: number) => void;
  onCanvasClick?: (positionX: number, positionY: number) => void;
}

export default function CctvCanvas({
  width,
  height,
  cameras,
  backgroundImageUrl,
  selectedCameraId,
  onSelectCamera,
  onCameraMove,
  onCanvasClick,
}: CctvCanvasProps) {
  const [backgroundImage] = useImage(backgroundImageUrl ?? '');
  const stageRef = useRef<Konva.Stage>(null);

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    // Só cria câmera nova se o clique foi no fundo (não em cima de uma câmera existente).
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image' && e.target.getClassName() !== 'Rect') {
      return;
    }
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (pointer && onCanvasClick) {
      onCanvasClick(pointer.x, pointer.y);
    }
  }

  return (
    <Stage ref={stageRef} width={width} height={height} onClick={handleStageClick}>
      <Layer>
        {backgroundImage ? (
          <KonvaImage image={backgroundImage} width={width} height={height} />
        ) : (
          <Rect x={0} y={0} width={width} height={height} fill="#0f172a" />
        )}
      </Layer>

      <Layer>
        {cameras.map((camera) => {
          const sector = computeFovSector(
            { x: camera.positionX, y: camera.positionY },
            camera.azimuth,
            camera.fovAngle,
            camera.rangeMeters,
          );
          const color = STATUS_COLORS[camera.status] ?? STATUS_COLORS.PLANNED;
          const isSelected = camera.id === selectedCameraId;

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
                x={camera.positionX}
                y={camera.positionY}
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
                  onCameraMove?.(camera.id, e.target.x(), e.target.y());
                }}
              />
              <Text
                x={camera.positionX + 8}
                y={camera.positionY - 6}
                text={camera.name}
                fontSize={12}
                fill="#e2e8f0"
              />
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
