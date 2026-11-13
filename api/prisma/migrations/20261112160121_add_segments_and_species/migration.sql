-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Segment" ADD VALUE 'POULTRY';
ALTER TYPE "Segment" ADD VALUE 'AQUACULTURE';

-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedById" TEXT;

-- CreateIndex
CREATE INDEX "Species_isApproved_idx" ON "Species"("isApproved");

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
