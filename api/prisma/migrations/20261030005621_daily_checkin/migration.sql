-- CreateTable
CREATE TABLE "DailyCheckin" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleep" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "energy" INTEGER,
    "hunger" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCheckin_pkey" PRIMARY KEY ("userId","date")
);

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

