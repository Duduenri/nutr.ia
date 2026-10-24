-- AlterEnum
ALTER TYPE "EntrySource" ADD VALUE 'SUPPLEMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bariatric" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "surgeryDate" DATE;

-- CreateTable
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "dose" TEXT,
    "proteinG" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION,
    "timesPerDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "mealEntryId" TEXT,

    CONSTRAINT "SupplementLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- CreateIndex
CREATE INDEX "SupplementLog_userId_date_idx" ON "SupplementLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "Supplement" ADD CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
