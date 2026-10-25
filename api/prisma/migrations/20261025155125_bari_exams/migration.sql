-- CreateEnum
CREATE TYPE "SurgeryType" AS ENUM ('BGA', 'SLEEVE', 'BYPASS', 'BPD_DS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "surgeryType" "SurgeryType";

-- CreateTable
CREATE TABLE "LabExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectedAt" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT,
    "date" DATE NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "refText" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabExam_userId_collectedAt_idx" ON "LabExam"("userId", "collectedAt");

-- CreateIndex
CREATE INDEX "LabResult_userId_code_idx" ON "LabResult"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_userId_code_date_key" ON "LabResult"("userId", "code", "date");

-- CreateIndex
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");

-- AddForeignKey
ALTER TABLE "LabExam" ADD CONSTRAINT "LabExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "LabExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

