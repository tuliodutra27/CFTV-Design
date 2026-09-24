/*
  Warnings:

  - You are about to drop the column `manufacturer` on the `Camera` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Camera` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LensType" AS ENUM ('FIXED', 'VARIFOCAL', 'MOTORIZED_ZOOM');

-- AlterTable
ALTER TABLE "Camera" DROP COLUMN "manufacturer",
DROP COLUMN "model",
ADD COLUMN     "cameraModelId" TEXT;

-- CreateTable
CREATE TABLE "CameraModel" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lensType" "LensType",
    "focalLengthMinMm" DOUBLE PRECISION,
    "focalLengthMaxMm" DOUBLE PRECISION,
    "fovHorizontalMaxDeg" DOUBLE PRECISION,
    "fovHorizontalMinDeg" DOUBLE PRECISION,
    "resolutionMp" DOUBLE PRECISION,
    "irRangeMeters" DOUBLE PRECISION,
    "datasheetUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CameraModel_slug_key" ON "CameraModel"("slug");

-- CreateIndex
CREATE INDEX "Camera_cameraModelId_idx" ON "Camera"("cameraModelId");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_cameraModelId_fkey" FOREIGN KEY ("cameraModelId") REFERENCES "CameraModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
