'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraDTO, CameraStatus } from '@/types/camera';
import type { CameraModelDTO } from '@/types/cameraModel';

// react-konva usa `window`/canvas — precisa ser carregado só no client.
const CctvCanvas = dynamic(() => import('@/components/map/CctvCanvas'), { ssr: false });

const DEFAULT_FOV_ANGLE = 90;
const DEFAULT_RANGE_METERS = 20;

export default function Home() {
  const [cameras, setCameras] = useState<CameraDTO[]>([]);
  const [cameraModels, setCameraModels] = useState<CameraModelDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const loadCameras = useCallback(async () => {
    const res = await fetch('/api/cameras');
    const data = (await res.json()) as CameraDTO[];
    setCameras(data);
    setLoading(false);
  }, []);

  const loadCameraModels = useCallback(async () => {
    const res = await fetch('/api/camera-models');
    const data = (await res.json()) as CameraModelDTO[];
    setCameraModels(data);
  }, []);

  useEffect(() => {
    loadCameras();
    loadCameraModels();
  }, [loadCameras, loadCameraModels]);

  useEffect(() => {
    function updateSize() {
      const el = canvasWrapperRef.current;
      if (el) {
        setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  async function handleCanvasClick(positionX: number, positionY: number) {
    const code = `CAM-${String(cameras.length + 1).padStart(3, '0')}`;
    const res = await fetch('/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        name: code,
        positionX,
        positionY,
        azimuth: 0,
        fovAngle: DEFAULT_FOV_ANGLE,
        rangeMeters: DEFAULT_RANGE_METERS,
        status: 'PLANNED',
      }),
    });
    const created = (await res.json()) as CameraDTO;
    setCameras((prev) => [...prev, created]);
    setSelectedId(created.id);
  }

  async function handleCameraMove(id: string, positionX: number, positionY: number) {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, positionX, positionY } : c)));
    await fetch(`/api/cameras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionX, positionY }),
    });
  }

  async function handleFieldChange(id: string, field: keyof CameraDTO, value: string | number) {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function handleFieldCommit(id: string, field: keyof CameraDTO, value: string | number) {
    await fetch(`/api/cameras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function handleModelChange(id: string, cameraModelId: string) {
    const model = cameraModels.find((m) => m.id === cameraModelId);
    // FOV mais largo (foco mínimo) é o mais conservador para estimar cobertura;
    // alcance de IR do datasheet vira o alcance default do cone.
    const patch: Partial<CameraDTO> = {
      cameraModelId: cameraModelId || null,
      ...(model?.fovHorizontalMaxDeg ? { fovAngle: model.fovHorizontalMaxDeg } : {}),
      ...(model?.irRangeMeters ? { rangeMeters: model.irRangeMeters } : {}),
    };

    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, cameraModel: model ?? null } : c)),
    );

    await fetch(`/api/cameras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  async function handleDelete(id: string) {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
  }

  return (
    <main style={{ display: 'flex', height: '100vh' }}>
      <div ref={canvasWrapperRef} style={{ flex: 1, position: 'relative' }}>
        {!loading && (
          <CctvCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            cameras={cameras}
            selectedCameraId={selectedId}
            onSelectCamera={setSelectedId}
            onCameraMove={handleCameraMove}
            onCanvasClick={handleCanvasClick}
          />
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 12, color: '#94a3b8' }}>
          Clique em uma área vazia para adicionar uma câmera · arraste uma câmera para reposicionar
        </div>
      </div>

      <aside
        style={{
          width: 340,
          borderLeft: '1px solid #1e293b',
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 16, margin: '4px 0 12px' }}>Câmeras ({cameras.length})</h1>

        {cameras.map((camera) => (
          <div
            key={camera.id}
            onClick={() => setSelectedId(camera.id)}
            style={{
              border: camera.id === selectedId ? '1px solid #38bdf8' : '1px solid #1e293b',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 13 }}>{camera.name}</strong>
                <div style={{ fontSize: 10, color: '#64748b' }}>{camera.code}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(camera.id);
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 12 }}
              >
                remover
              </button>
            </div>

            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              Nome
              <input
                value={camera.name}
                onChange={(e) => handleFieldChange(camera.id, 'name', e.target.value)}
                onBlur={(e) => handleFieldCommit(camera.id, 'name', e.target.value)}
              />
            </label>

            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              Modelo
              <select
                value={camera.cameraModelId ?? ''}
                onChange={(e) => handleModelChange(camera.id, e.target.value)}
              >
                <option value="">— selecionar —</option>
                {cameraModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manufacturer} {m.model}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
                Azimute (°)
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={camera.azimuth}
                  onChange={(e) => handleFieldChange(camera.id, 'azimuth', Number(e.target.value))}
                  onBlur={(e) => handleFieldCommit(camera.id, 'azimuth', Number(e.target.value))}
                />
              </label>
              <label style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
                Abertura (°)
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={camera.fovAngle}
                  onChange={(e) => handleFieldChange(camera.id, 'fovAngle', Number(e.target.value))}
                  onBlur={(e) => handleFieldCommit(camera.id, 'fovAngle', Number(e.target.value))}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
                Alcance (m)
                <input
                  type="number"
                  min={1}
                  value={camera.rangeMeters}
                  onChange={(e) => handleFieldChange(camera.id, 'rangeMeters', Number(e.target.value))}
                  onBlur={(e) => handleFieldCommit(camera.id, 'rangeMeters', Number(e.target.value))}
                />
              </label>
              <label style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
                Status
                <select
                  value={camera.status}
                  onChange={(e) => {
                    const value = e.target.value as CameraStatus;
                    handleFieldChange(camera.id, 'status', value);
                    handleFieldCommit(camera.id, 'status', value);
                  }}
                >
                  <option value="PLANNED">Planejada</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="INACTIVE">Inativa</option>
                  <option value="MAINTENANCE">Manutenção</option>
                </select>
              </label>
            </div>
          </div>
        ))}

        {!loading && cameras.length === 0 && (
          <p style={{ fontSize: 12, color: '#64748b' }}>
            Nenhuma câmera cadastrada ainda. Clique no canvas à esquerda para adicionar a primeira.
          </p>
        )}
      </aside>
    </main>
  );
}
