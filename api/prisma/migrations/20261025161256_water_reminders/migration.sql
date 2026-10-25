-- AlterTable
ALTER TABLE "User" ADD COLUMN     "waterReminder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waterReminderEnd" TEXT NOT NULL DEFAULT '22:00',
ADD COLUMN     "waterReminderEvery" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "waterReminderStart" TEXT NOT NULL DEFAULT '08:00';

