-- CreateTable
CREATE TABLE "RangeColorSetting" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RangeColorSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RangeColorSetting_username_key" ON "RangeColorSetting"("username");
