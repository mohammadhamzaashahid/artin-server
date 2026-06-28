-- CreateEnum
CREATE TYPE "LiveClassStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "LiveClass" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timeDuration" INTEGER NOT NULL,
    "joiningLink" TEXT,
    "status" "LiveClassStatus" NOT NULL DEFAULT 'DRAFT',
    "courseId" TEXT,
    "bannerImageAssetId" TEXT,
    "createdByAdminId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassMaterial" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassPrice" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClassPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "liveClassPriceId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "purchasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClassPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveClass_slug_key" ON "LiveClass"("slug");

-- CreateIndex
CREATE INDEX "LiveClass_status_idx" ON "LiveClass"("status");

-- CreateIndex
CREATE INDEX "LiveClass_startDate_idx" ON "LiveClass"("startDate");

-- CreateIndex
CREATE INDEX "LiveClass_courseId_idx" ON "LiveClass"("courseId");

-- CreateIndex
CREATE INDEX "LiveClass_deletedAt_idx" ON "LiveClass"("deletedAt");

-- CreateIndex
CREATE INDEX "LiveClassMaterial_liveClassId_idx" ON "LiveClassMaterial"("liveClassId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassMaterial_liveClassId_mediaAssetId_key" ON "LiveClassMaterial"("liveClassId", "mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassPrice_stripePriceId_key" ON "LiveClassPrice"("stripePriceId");

-- CreateIndex
CREATE INDEX "LiveClassPrice_liveClassId_idx" ON "LiveClassPrice"("liveClassId");

-- CreateIndex
CREATE INDEX "LiveClassPrice_isActive_idx" ON "LiveClassPrice"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassPurchase_stripeCheckoutSessionId_key" ON "LiveClassPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassPurchase_stripePaymentIntentId_key" ON "LiveClassPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "LiveClassPurchase_userId_idx" ON "LiveClassPurchase"("userId");

-- CreateIndex
CREATE INDEX "LiveClassPurchase_liveClassId_idx" ON "LiveClassPurchase"("liveClassId");

-- CreateIndex
CREATE INDEX "LiveClassPurchase_status_idx" ON "LiveClassPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassPurchase_userId_liveClassId_key" ON "LiveClassPurchase"("userId", "liveClassId");

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_bannerImageAssetId_fkey" FOREIGN KEY ("bannerImageAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassMaterial" ADD CONSTRAINT "LiveClassMaterial_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassMaterial" ADD CONSTRAINT "LiveClassMaterial_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassPrice" ADD CONSTRAINT "LiveClassPrice_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassPurchase" ADD CONSTRAINT "LiveClassPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassPurchase" ADD CONSTRAINT "LiveClassPurchase_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassPurchase" ADD CONSTRAINT "LiveClassPurchase_liveClassPriceId_fkey" FOREIGN KEY ("liveClassPriceId") REFERENCES "LiveClassPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
