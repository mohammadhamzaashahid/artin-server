-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'DOCUMENT';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "outlineDocumentAssetId" TEXT;

-- CreateTable
CREATE TABLE "CourseFlyerAsset" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseFlyerAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBatch" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "numberOfSessions" INTEGER NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'UPCOMING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseFlyerAsset_courseId_idx" ON "CourseFlyerAsset"("courseId");

-- CreateIndex
CREATE INDEX "CourseFlyerAsset_mediaAssetId_idx" ON "CourseFlyerAsset"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseFlyerAsset_courseId_mediaAssetId_key" ON "CourseFlyerAsset"("courseId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "CourseBatch_courseId_idx" ON "CourseBatch"("courseId");

-- CreateIndex
CREATE INDEX "CourseBatch_status_idx" ON "CourseBatch"("status");

-- CreateIndex
CREATE INDEX "CourseBatch_startDate_idx" ON "CourseBatch"("startDate");

-- CreateIndex
CREATE INDEX "CourseBatch_isActive_idx" ON "CourseBatch"("isActive");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_outlineDocumentAssetId_fkey" FOREIGN KEY ("outlineDocumentAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFlyerAsset" ADD CONSTRAINT "CourseFlyerAsset_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFlyerAsset" ADD CONSTRAINT "CourseFlyerAsset_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBatch" ADD CONSTRAINT "CourseBatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
