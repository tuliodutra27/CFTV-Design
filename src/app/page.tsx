'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { CameraDTO, CameraStatus } from '@/types/camera';
import type { CameraModelDTO } from '@/types/cameraModel';
import type { BackgroundMapDTO } from '@/types/backgroundMap';
import type { Point } from '@/lib/geometry';
import type { Bounds } from '@/components/map/CctvCanvas';
import MenuSection from '@/components/layout/MenuSection';

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

  const [backgroundMap, setBackgroundMap] = useState<BackgroundMapDTO | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [zoomPercent, setZoomPercent] = useState(100);

  // Sempre abre em somente-leitura — precisa clicar em "editar" pra evitar edição acidental.
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [centerTarget, setCenterTarget] = useState<Point | null>(null);

  const [markingMode, setMarkingMode] = useState(false);
  const [markingLocationName, setMarkingLocationName] = useState('');
  // Só existe enquanto a página está aberta (não persiste) — é só pra guiar a sequência de
  // marcação; marcar de novo um local já feito não tem problema (idempotente).
  const [markedLocations, setMarkedLocations] = useState<Set<string>>(new Set());

  const [viewFilterLocation, setViewFilterLocation] = useState<string | null>(null);
  const [fitBounds, setFitBounds] = useState<Bounds | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const loadBackgroundMap = useCallback(async () => {
    const res = await fetch('/api/background-maps');
    const data = (await res.json()) as BackgroundMapDTO | null;
    setBackgroundMap(data);
  }, []);

  useEffect(() => {
    loadCameras();
    loadCameraModels();
    loadBackgroundMap();
  }, [loadCameras, loadCameraModels, loadBackgroundMap]);

  useEffect(() => {
    if (!editMode && calibrating) {
      setCalibrating(false);
      setCalibrationPoints([]);
      setCalibrationDistance('');
    }
    if (!editMode && markingMode) {
      setMarkingMode(false);
    }
  }, [editMode, calibrating, markingMode]);

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
    if (!editMode) return;
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
    if (!editMode) return;
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
    if (!editMode) return;
    await fetch(`/api/cameras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function handleModelChange(id: string, cameraModelId: string) {
    if (!editMode) return;
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
    if (!editMode) return;
    setCameras((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
  }

  function readImageDimensions(file: File): Promise<{ widthPx: number; heightPx: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível ler a imagem'));
      };
      img.src = url;
    });
  }

  async function handleUploadSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editMode) return;
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('image') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file || !uploadName.trim()) return;

    setUploading(true);
    try {
      const { widthPx, heightPx } = await readImageDimensions(file);
      const body = new FormData();
      body.append('image', file);
      body.append('name', uploadName.trim());
      body.append('widthPx', String(widthPx));
      body.append('heightPx', String(heightPx));

      const res = await fetch('/api/background-maps', { method: 'POST', body });
      const created = (await res.json()) as BackgroundMapDTO;
      setBackgroundMap(created);
      setUploadName('');
      form.reset();
    } finally {
      setUploading(false);
    }
  }

  function handleStartCalibration() {
    if (!editMode) return;
    setMarkingMode(false);
    setCalibrating(true);
    setCalibrationPoints([]);
    setCalibrationDistance('');
  }

  function handleCancelCalibration() {
    setCalibrating(false);
    setCalibrationPoints([]);
    setCalibrationDistance('');
  }

  function handleCalibrationPoint(pixelX: number, pixelY: number) {
    setCalibrationPoints((prev) => (prev.length >= 2 ? [{ x: pixelX, y: pixelY }] : [...prev, { x: pixelX, y: pixelY }]));
  }

  async function handleCalibrationSubmit() {
    if (!backgroundMap || calibrationPoints.length !== 2) return;
    const distanceMeters = Number(calibrationDistance);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return;

    const [a, b] = calibrationPoints;
    const pixelDistance = Math.hypot(b.x - a.x, b.y - a.y);
    const scaleMetersPerPixel = distanceMeters / pixelDistance;

    const res = await fetch(`/api/background-maps/${backgroundMap.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scaleMetersPerPixel }),
    });
    const updated = (await res.json()) as BackgroundMapDTO;
    setBackgroundMap(updated);
    handleCancelCalibration();
  }

  // As câmeras importadas do NetBox guardam a localização crua em notes: "Local (NetBox): <site>"
  // (opcionalmente seguido de " | Obs: ...") — usado tanto na busca quanto no modo "marcar local".
  function parseLocation(notes: string | null | undefined): string | null {
    if (!notes) return null;
    const match = notes.match(/^Local \(NetBox\): (.+?)(?: \| Obs:|$)/);
    return match ? match[1] : null;
  }

  const locationGroups = (() => {
    const counts = new Map<string, number>();
    for (const camera of cameras) {
      const location = parseLocation(camera.notes);
      if (location) counts.set(location, (counts.get(location) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  function pickNextUnmarkedLocation(afterName: string, marked: Set<string>) {
    if (locationGroups.length === 0) return afterName;
    const currentIndex = locationGroups.findIndex((l) => l.name === afterName);
    for (let step = 1; step <= locationGroups.length; step++) {
      const candidate = locationGroups[(currentIndex + step) % locationGroups.length];
      if (!marked.has(candidate.name)) return candidate.name;
    }
    return afterName; // todos já marcados
  }

  function handleStartMarking() {
    if (!editMode || locationGroups.length === 0) return;
    setCalibrating(false);
    setMarkingMode(true);
    // Retoma no local em que parou, se ele ainda não tiver sido marcado; senão pega o primeiro
    // da lista que ainda falta (ou o primeiro de todos, se já passou por todos).
    if (markingLocationName && !markedLocations.has(markingLocationName)) return;
    const firstUnmarked = locationGroups.find((l) => !markedLocations.has(l.name));
    setMarkingLocationName(firstUnmarked ? firstUnmarked.name : locationGroups[0].name);
  }

  function handleStopMarking() {
    setMarkingMode(false);
  }

  // Reposiciona, num cluster pequeno em volta do ponto clicado, todas as câmeras cuja localização
  // (do NetBox) bate com a selecionada — assim não precisa arrastar câmera por câmera.
  async function handleLocationMark(centerX: number, centerY: number) {
    if (!editMode || !markingLocationName) return;
    const matching = cameras.filter((c) => parseLocation(c.notes) === markingLocationName);
    if (matching.length === 0) return;

    const SPACING_METERS = 4;
    const cols = Math.min(4, matching.length);
    const rows = Math.ceil(matching.length / cols);
    const offsetX = ((cols - 1) * SPACING_METERS) / 2;
    const offsetY = ((rows - 1) * SPACING_METERS) / 2;

    const updates = matching.map((camera, i) => ({
      id: camera.id,
      positionX: centerX + (i % cols) * SPACING_METERS - offsetX,
      positionY: centerY + Math.floor(i / cols) * SPACING_METERS - offsetY,
    }));

    setCameras((prev) =>
      prev.map((c) => {
        const update = updates.find((u) => u.id === c.id);
        return update ? { ...c, positionX: update.positionX, positionY: update.positionY } : c;
      }),
    );

    await Promise.all(
      updates.map((u) =>
        fetch(`/api/cameras/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionX: u.positionX, positionY: u.positionY }),
        }),
      ),
    );

    setMarkedLocations((prev) => {
      const next = new Set(prev).add(markingLocationName);
      setMarkingLocationName(pickNextUnmarkedLocation(markingLocationName, next));
      return next;
    });
  }

  // Filtra a visualização por área: esmaece as demais câmeras e enquadra o zoom nessa área
  // (usando o alcance de cada câmera, não só a posição, pra caber o cone inteiro na tela).
  function handleViewFilterChange(locationName: string) {
    if (!locationName) {
      setViewFilterLocation(null);
      setFitBounds(null);
      return;
    }
    setViewFilterLocation(locationName);
    const matching = cameras.filter((c) => parseLocation(c.notes) === locationName);
    if (matching.length === 0) {
      setFitBounds(null);
      return;
    }
    const minX = Math.min(...matching.map((c) => c.positionX - c.rangeMeters));
    const maxX = Math.max(...matching.map((c) => c.positionX + c.rangeMeters));
    const minY = Math.min(...matching.map((c) => c.positionY - c.rangeMeters));
    const maxY = Math.max(...matching.map((c) => c.positionY + c.rangeMeters));
    setFitBounds({ x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) });
  }

  const focusedCameraIds = viewFilterLocation
    ? new Set(
        cameras.filter((c) => parseLocation(c.notes) === viewFilterLocation).map((c) => c.id),
      )
    : null;

  function normalize(value: string) {
    return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  const trimmedQuery = normalize(searchQuery.trim());
  const filteredCameras = trimmedQuery
    ? cameras.filter((c) =>
        [c.name, c.code, c.notes ?? ''].some((field) => normalize(field).includes(trimmedQuery)),
      )
    : cameras;

  function handleSelectCamera(camera: CameraDTO) {
    setSelectedId(camera.id);
    setCenterTarget({ x: camera.positionX, y: camera.positionY });
  }

  return (
    <main style={{ display: 'flex', height: '100vh' }}>
      <div ref={canvasWrapperRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!loading && (
          <CctvCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            cameras={cameras}
            backgroundImageUrl={backgroundMap?.imageUrl}
            scaleMetersPerPixel={backgroundMap?.scaleMetersPerPixel ?? 1}
            editMode={editMode}
            selectedCameraId={selectedId}
            onSelectCamera={setSelectedId}
            onCameraMove={handleCameraMove}
            onCanvasClick={handleCanvasClick}
            calibrating={calibrating}
            calibrationPoints={calibrationPoints}
            onCalibrationPoint={handleCalibrationPoint}
            onScaleChange={(scale) => setZoomPercent(Math.round(scale * 100))}
            centerOnMeters={centerTarget}
            markingMode={markingMode}
            onLocationMark={handleLocationMark}
            focusedCameraIds={focusedCameraIds}
            fitBoundsMeters={fitBounds}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontSize: 12,
            color: calibrating || markingMode ? '#facc15' : '#94a3b8',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          {calibrating
            ? `Calibração: clique em 2 pontos com distância real conhecida (${calibrationPoints.length}/2 marcados)`
            : markingMode
              ? `Marcando local (${markedLocations.size}/${locationGroups.length}): clique onde fica "${markingLocationName}" — as câmeras de lá vão se juntar ali`
              : editMode
                ? `Clique para adicionar câmera · arraste uma câmera para reposicionar · arraste o fundo para navegar · roda do mouse para zoom (${zoomPercent}%)`
                : `Somente leitura · arraste o fundo para navegar · roda do mouse para zoom (${zoomPercent}%)`}
        </div>
      </div>

      <aside
        style={{
          width: sidebarCollapsed ? 56 : 340,
          borderLeft: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          background: '#0b1220',
          transition: 'width 0.15s',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: sidebarCollapsed ? '12px 8px' : '12px 14px',
            borderBottom: '1px solid #1e293b',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-aliseo.jpg"
            alt="ALISEO"
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          />
          {!sidebarCollapsed && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.4 }}>
              CFTV DESIGN
            </span>
          )}
        </div>

        <button
          onClick={() => setEditMode((prev) => !prev)}
          title={editMode ? 'Editando — clique para bloquear' : 'Somente leitura — clique para editar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 8,
            margin: sidebarCollapsed ? '10px auto' : '10px 14px',
            padding: sidebarCollapsed ? 8 : '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: editMode ? '1px solid #22c55e' : '1px solid #475569',
            background: editMode ? 'rgba(34,197,94,0.15)' : 'rgba(71,85,105,0.15)',
            color: editMode ? '#22c55e' : '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <span>✎</span>
          {!sidebarCollapsed && (
            <span>{editMode ? 'Editando — clique para bloquear' : 'Somente leitura — editar'}</span>
          )}
        </button>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 8 }}>
              <button
                onClick={() => setSidebarCollapsed(false)}
                title="Mapa"
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 18, cursor: 'pointer' }}
              >
                ▦
              </button>
              <button
                onClick={() => setSidebarCollapsed(false)}
                title="Câmeras"
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 18, cursor: 'pointer' }}
              >
                ▤
              </button>
            </div>
          ) : (
            <>
              <MenuSection icon="▦" label="Mapa">
                {locationGroups.length > 0 && (
                  <label style={{ fontSize: 11, color: '#94a3b8' }}>
                    Filtrar área (destaca só as câmeras de lá, com cores diferentes)
                    <select
                      value={viewFilterLocation ?? ''}
                      onChange={(e) => handleViewFilterChange(e.target.value)}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Ver todas as áreas</option>
                      {locationGroups.map((l) => (
                        <option key={l.name} value={l.name}>
                          {l.name} ({l.count})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div
                  style={{
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <h3 style={{ fontSize: 12, margin: 0 }}>Mapa de fundo</h3>

                  {backgroundMap ? (
                    <>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {backgroundMap.name} — {backgroundMap.widthPx}×{backgroundMap.heightPx}px
                        <br />
                        Escala: {backgroundMap.scaleMetersPerPixel.toFixed(4)} m/px
                      </div>
                      {editMode && !calibrating && (
                        <button onClick={handleStartCalibration} style={{ fontSize: 11 }}>
                          Calibrar escala
                        </button>
                      )}
                      {calibrating && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {calibrationPoints.length === 2 && (
                            <label style={{ fontSize: 11, color: '#94a3b8' }}>
                              Distância real entre os pontos (m)
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                value={calibrationDistance}
                                onChange={(e) => setCalibrationDistance(e.target.value)}
                                autoFocus
                              />
                            </label>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            {calibrationPoints.length === 2 && (
                              <button onClick={handleCalibrationSubmit} style={{ fontSize: 11, flex: 1 }}>
                                Salvar calibração
                              </button>
                            )}
                            <button onClick={handleCancelCalibration} style={{ fontSize: 11, flex: 1 }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                      Nenhuma imagem de fundo ainda — as câmeras estão em posições provisórias.
                    </p>
                  )}

                  {editMode && (
                    <form
                      onSubmit={handleUploadSubmit}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #1e293b', paddingTop: 6 }}
                    >
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>
                        {backgroundMap ? 'Trocar imagem' : 'Enviar imagem'}
                        <input type="file" name="image" accept="image/*" required />
                      </label>
                      <input
                        type="text"
                        placeholder="Nome (ex: Planta drone 2026-09)"
                        value={uploadName}
                        onChange={(e) => setUploadName(e.target.value)}
                        required
                      />
                      <button type="submit" disabled={uploading} style={{ fontSize: 11 }}>
                        {uploading ? 'Enviando...' : 'Enviar'}
                      </button>
                    </form>
                  )}
                </div>

                {editMode && locationGroups.length > 0 && (
                  <div
                    style={{
                      border: '1px solid #1e293b',
                      borderRadius: 6,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <h3 style={{ fontSize: 12, margin: 0 }}>Marcar local</h3>

                    {!markingMode ? (
                      <>
                        <ol style={{ fontSize: 11, color: '#64748b', margin: 0, paddingLeft: 16 }}>
                          <li>Clique em &quot;Marcar local&quot; abaixo.</li>
                          <li>Confira o local mostrado no seletor (já vem escolhido).</li>
                          <li>
                            Clique no mapa exatamente onde esse local fica — as câmeras dele pulam
                            pra um cluster pequeno ali, prontas pra você ajustar uma a uma se
                            precisar.
                          </li>
                          <li>Ele já avança pro próximo local sozinho — repete o passo 3.</li>
                        </ol>
                        {markedLocations.size > 0 && (
                          <p style={{ fontSize: 11, color: '#22c55e', margin: 0 }}>
                            {markedLocations.size} de {locationGroups.length} locais já marcados.
                          </p>
                        )}
                        <button onClick={handleStartMarking} style={{ fontSize: 11 }} disabled={calibrating}>
                          Marcar local
                        </button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 11, color: '#facc15', margin: 0 }}>
                          {markedLocations.size} de {locationGroups.length} marcados — clique no
                          mapa onde fica o local selecionado abaixo.
                        </p>
                        <label style={{ fontSize: 11, color: '#94a3b8' }}>
                          Local atual
                          <select
                            value={markingLocationName}
                            onChange={(e) => setMarkingLocationName(e.target.value)}
                          >
                            {locationGroups.map((l) => (
                              <option key={l.name} value={l.name}>
                                {markedLocations.has(l.name) ? '(feito) ' : ''}
                                {l.name} ({l.count})
                              </option>
                            ))}
                          </select>
                        </label>
                        <button onClick={handleStopMarking} style={{ fontSize: 11 }}>
                          Concluir marcação
                        </button>
                      </>
                    )}
                  </div>
                )}
              </MenuSection>

              <MenuSection icon="▤" label="Câmeras" defaultOpen badge={filteredCameras.length}>
                <input
                  type="text"
                  placeholder="Buscar câmera (nome, serial, local)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 8px' }}
                />

                {filteredCameras.map((camera) => (
                  <div
                    key={camera.id}
                    onClick={() => handleSelectCamera(camera)}
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
                      {editMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(camera.id);
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 12 }}
                        >
                          remover
                        </button>
                      )}
                    </div>

                    <label style={{ fontSize: 11, color: '#94a3b8' }}>
                      Nome
                      <input
                        value={camera.name}
                        disabled={!editMode}
                        onChange={(e) => handleFieldChange(camera.id, 'name', e.target.value)}
                        onBlur={(e) => handleFieldCommit(camera.id, 'name', e.target.value)}
                      />
                    </label>

                    <label style={{ fontSize: 11, color: '#94a3b8' }}>
                      Modelo
                      <select
                        value={camera.cameraModelId ?? ''}
                        disabled={!editMode}
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
                          disabled={!editMode}
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
                          disabled={!editMode}
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
                          disabled={!editMode}
                          onChange={(e) => handleFieldChange(camera.id, 'rangeMeters', Number(e.target.value))}
                          onBlur={(e) => handleFieldCommit(camera.id, 'rangeMeters', Number(e.target.value))}
                        />
                      </label>
                      <label style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
                        Status
                        <select
                          value={camera.status}
                          disabled={!editMode}
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
                    Nenhuma câmera cadastrada ainda.
                    {editMode && ' Clique no canvas à esquerda para adicionar a primeira.'}
                  </p>
                )}

                {!loading && cameras.length > 0 && filteredCameras.length === 0 && (
                  <p style={{ fontSize: 12, color: '#64748b' }}>
                    Nenhuma câmera encontrada para &quot;{searchQuery}&quot;.
                  </p>
                )}
              </MenuSection>
            </>
          )}
        </div>

        <button
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: '10px 14px',
            fontSize: 12,
            color: '#94a3b8',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid #1e293b',
            cursor: 'pointer',
          }}
        >
          <span>{sidebarCollapsed ? '»' : '«'}</span>
          {!sidebarCollapsed && <span>Recolher menu</span>}
        </button>
      </aside>
    </main>
  );
}
