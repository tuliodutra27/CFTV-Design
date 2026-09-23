export const LensTypeValues = ['FIXED', 'VARIFOCAL', 'MOTORIZED_ZOOM'] as const;
export type LensType = (typeof LensTypeValues)[number];

export interface CameraModelDTO {
  id: string;
  manufacturer: string;
  model: string;
  slug: string;
  lensType: LensType | null;
  focalLengthMinMm: number | null;
  focalLengthMaxMm: number | null;
  fovHorizontalMaxDeg: number | null;
  fovHorizontalMinDeg: number | null;
  resolutionMp: number | null;
  irRangeMeters: number | null;
  datasheetUrl: string | null;
  notes: string | null;
}
