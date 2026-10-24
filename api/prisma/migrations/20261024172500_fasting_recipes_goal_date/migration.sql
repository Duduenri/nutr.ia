-- AlterEnum
ALTER TYPE "EntrySource" ADD VALUE 'RECIPE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fastingPlan" TEXT,
ADD COLUMN     "targetDate" DATE;

-- CreateTable
CREATE TABLE "Fast" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "goalHours" INTEGER NOT NULL,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "meal" "MealType" NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "servingG" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL,
    "ingredients" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "tip" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fast_userId_startAt_idx" ON "Fast"("userId", "startAt");

-- CreateIndex
CREATE INDEX "Recipe_userId_createdAt_idx" ON "Recipe"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Fast" ADD CONSTRAINT "Fast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

