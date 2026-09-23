import { z } from 'zod';
import type { CameraModelDTO } from './cameraModel';

export const CameraStatusValues = ['PLANNED', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;
export type CameraStatus = (typeof CameraStatusValues)[number];

export const cameraInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  cameraModelId: z.string().optional().nullable(),
  positionX: z.number(),
  positionY: z.number(),
  installHeight: z.number().optional().nullable(),
  azimuth: z.number().min(0).max(360),
  fovAngle: z.number().min(1).max(360),
  rangeMeters: z.number().positive(),
  status: z.enum(CameraStatusValues).default('PLANNED'),
  notes: z.string().optional().nullable(),
});

export type CameraInput = z.infer<typeof cameraInputSchema>;

export const cameraUpdateSchema = cameraInputSchema.partial();
export type CameraUpdate = z.infer<typeof cameraUpdateSchema>;

export interface CameraDTO extends CameraInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  cameraModel?: CameraModelDTO | null;
}
