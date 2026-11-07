-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freeMeal" "MealType",
ADD COLUMN     "freeMealEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeMealSince" DATE,
ADD COLUMN     "freeMealWeekday" INTEGER;

-- CreateTable
CREATE TABLE "FreeMealWeek" (
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "date" DATE NOT NULL,
    "meal" "MealType" NOT NULL,
    "swapped" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeMealWeek_pkey" PRIMARY KEY ("userId","weekStart")
);

-- AddForeignKey
ALTER TABLE "FreeMealWeek" ADD CONSTRAINT "FreeMealWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

