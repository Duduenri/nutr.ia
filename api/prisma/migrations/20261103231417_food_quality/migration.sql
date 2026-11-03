-- CreateEnum
CREATE TYPE "FoodQuality" AS ENUM ('GOOD', 'OK', 'BAD');

-- AlterTable
ALTER TABLE "MealEntry" ADD COLUMN     "quality" "FoodQuality",
ADD COLUMN     "qualityTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

