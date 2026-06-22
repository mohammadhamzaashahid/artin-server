-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookAudioStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdByAdminId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCoverImage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookCoverImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAudioFile" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audioOrder" INTEGER NOT NULL,
    "isPreviewFree" BOOLEAN NOT NULL DEFAULT false,
    "status" "BookAudioStatus" NOT NULL DEFAULT 'DRAFT',
    "audioMediaAssetId" TEXT,
    "durationSeconds" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookAudioFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" "BookOrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deliveryName" TEXT NOT NULL,
    "deliveryEmail" TEXT NOT NULL,
    "deliveryPhone" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryState" TEXT,
    "deliveryPostalCode" TEXT,
    "deliveryCountry" TEXT NOT NULL DEFAULT 'Pakistan',
    "deliveryNotes" TEXT,
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE INDEX "Book_deletedAt_idx" ON "Book"("deletedAt");

-- CreateIndex
CREATE INDEX "Book_createdAt_idx" ON "Book"("createdAt");

-- CreateIndex
CREATE INDEX "BookCoverImage_bookId_idx" ON "BookCoverImage"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCoverImage_bookId_mediaAssetId_key" ON "BookCoverImage"("bookId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "BookAudioFile_bookId_idx" ON "BookAudioFile"("bookId");

-- CreateIndex
CREATE INDEX "BookAudioFile_status_idx" ON "BookAudioFile"("status");

-- CreateIndex
CREATE INDEX "BookAudioFile_isPreviewFree_idx" ON "BookAudioFile"("isPreviewFree");

-- CreateIndex
CREATE INDEX "BookAudioFile_deletedAt_idx" ON "BookAudioFile"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookAudioFile_bookId_audioOrder_key" ON "BookAudioFile"("bookId", "audioOrder");

-- CreateIndex
CREATE INDEX "BookOrder_userId_idx" ON "BookOrder"("userId");

-- CreateIndex
CREATE INDEX "BookOrder_bookId_idx" ON "BookOrder"("bookId");

-- CreateIndex
CREATE INDEX "BookOrder_status_idx" ON "BookOrder"("status");

-- CreateIndex
CREATE INDEX "BookOrder_createdAt_idx" ON "BookOrder"("createdAt");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCoverImage" ADD CONSTRAINT "BookCoverImage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCoverImage" ADD CONSTRAINT "BookCoverImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAudioFile" ADD CONSTRAINT "BookAudioFile_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAudioFile" ADD CONSTRAINT "BookAudioFile_audioMediaAssetId_fkey" FOREIGN KEY ("audioMediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookOrder" ADD CONSTRAINT "BookOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookOrder" ADD CONSTRAINT "BookOrder_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
