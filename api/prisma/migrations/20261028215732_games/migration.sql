-- CreateTable
CREATE TABLE "GameDay" (
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "state" JSONB NOT NULL,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "reward" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDay_pkey" PRIMARY KEY ("userId","game","day")
);

-- AddForeignKey
ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

