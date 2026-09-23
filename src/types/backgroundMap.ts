export interface BackgroundMapDTO {
  id: string;
  name: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  scaleMetersPerPixel: number;
  isActive: boolean;
  createdAt: string;
}
