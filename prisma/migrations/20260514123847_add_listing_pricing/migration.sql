-- CreateEnum
CREATE TYPE "PricingBadge" AS ENUM ('NEW', 'RECOMMENDED', 'POPULAR', 'BEST_VALUE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "againstRole" "Role" NOT NULL DEFAULT 'HOST';

-- CreateTable
CREATE TABLE "ListingPricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "badge" "PricingBadge",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "ListingPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingPricing_listingId_idx" ON "ListingPricing"("listingId");

-- CreateIndex
CREATE INDEX "ListingPricing_sortOrder_idx" ON "ListingPricing"("sortOrder");

-- CreateIndex
CREATE INDEX "Dispute_againstRole_idx" ON "Dispute"("againstRole");

-- AddForeignKey
ALTER TABLE "ListingPricing" ADD CONSTRAINT "ListingPricing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
