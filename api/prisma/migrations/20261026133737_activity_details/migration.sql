-- CreateEnum
CREATE TYPE "Intensity" AS ENUM ('LIGHT', 'MODERATE', 'VIGOROUS');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "details" TEXT,
ADD COLUMN     "intensity" "Intensity";

