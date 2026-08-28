/*
  Warnings:

  - You are about to drop the column `unitPriceMinor` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `priceMinor` on the `Product` table. All the data in the column will be lost.
  - Added the required column `unitPrice` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "unitPriceMinor",
ADD COLUMN     "unitPrice" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "priceMinor",
ADD COLUMN     "price" INTEGER NOT NULL;
