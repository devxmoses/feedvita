/*
  Warnings:

  - A unique constraint covering the columns `[productId,authorId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_authorId_key" ON "Review"("productId", "authorId");
