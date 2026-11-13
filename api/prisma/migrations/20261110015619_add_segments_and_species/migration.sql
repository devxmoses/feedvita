-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('HUMAN', 'PET', 'LIVESTOCK');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "segments" "Segment"[];

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductToSpecies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToSpecies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Species_name_key" ON "Species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Species_slug_key" ON "Species"("slug");

-- CreateIndex
CREATE INDEX "Species_segment_idx" ON "Species"("segment");

-- CreateIndex
CREATE INDEX "_ProductToSpecies_B_index" ON "_ProductToSpecies"("B");

-- CreateIndex
CREATE INDEX "Product_segments_idx" ON "Product" USING GIN ("segments" array_ops);

-- AddForeignKey
ALTER TABLE "_ProductToSpecies" ADD CONSTRAINT "_ProductToSpecies_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToSpecies" ADD CONSTRAINT "_ProductToSpecies_B_fkey" FOREIGN KEY ("B") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
